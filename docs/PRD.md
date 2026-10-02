# PRD — Maison Editorial Shop (Home & Living)

- **Version:** 1.3 (locked for V1 build)
- **Status:** Approved for implementation
- **Store model:** Single store, physical goods, Cash on Delivery + Paystack online (Paystack off by default behind admin toggle)
- **Catalog:** Large (~150 seed products), Home & Living
- **Design language:** Luxury editorial, Awwwards cinematic
- **Stack:** Next.js 15 + Neon Postgres + Drizzle (`neon-http`) + Better Auth (Google shoppers + separate email+password admin) + Cloudinary + Mailgun + Paystack — see `DECISIONS.md` ADR-001–009, ADR-020–021
- **Worktree:** `../storefront-build` on branch `feature/shop-v1` (main stays clean)

---

## 1. Vision

A shop that feels like an interiors magazine that happens to sell. Editorial room stories, oversized serif headlines, warm paper surfaces — with a boringly reliable checkout underneath: Google login, live zone fees, admin-driven currencies, branded order emails.

Pay COD at the door, or pay now online via Paystack (cards, transfers, USSD) — the shopper picks at checkout from whatever methods the admin has enabled. COD stays fully intact as the default.

## 2. Goals / Non-Goals

**Goals (V1 must):**
1. Browse 100s of Home & Living products with search, room/category filters, sort, pagination.
2. Google-only login (Better Auth library + Google Cloud Console) required to order.
3. Persistent cart (DB for logged users, localStorage merge on login).
4. Industry-standard checkout (COD + Paystack) with live shipping-zone fee + admin-driven currency switch + honest totals (review-confirm modal, `PRICE_CHANGED` re-confirm on drift).
5. Server-validated orders (re-price from DB, stock check, transactional insert; Paystack orders decrement stock only after gateway verify).
6. Branded Mailgun emails to buyer + owner/seller + admin on every paid/placed order, with retry + log.
7. Admin dashboard: products CRUD + stock, orders lifecycle (+ Paystack refunds), currencies, shipping zones/rates, payment-method toggle.
8. $0 infra before gateway fees: Next.js on Vercel Free, Neon Free Postgres, Cloudinary Free, Mailgun Free 100/day. (Paystack per-transaction fees apply only to online payments.)

**Non-Goals (explicitly out of V1):**
- Discounts/coupons, reviews, wishlist, multi-vendor onboarding, multi-language, native apps.

## 3. Personas

- **Shopper (Amara):** mobile-first, browses rooms, compares dimensions/materials, checks out COD, wants confirmation email + delivery call. Guest can browse, must Google-login to buy.
- **Owner/Admin (Shop team):** adds products, adjusts stock, confirms/cancels orders, configures currencies + shipping zones without code, receives fulfillment + digest emails.
- **Support:** reads `orders` + `email_log` to resolve "where is my order / did email send".

## 4. Scope — Features

### F1. Storefront shell + design system
- Luxury editorial tokens: paper `#F7F3EC`, ink `#1C1917`, bronze accent `#9A7B4F` (tinted, never pure black/white), plus paper-deep/cream/linen, ink-soft/mute, bronze-deep, clay/moss/blush support tones. Fraunces display + Space Grotesk body, fluid `clamp()` type scale.
- No AI-slop: no cards-everywhere, no purple-blue gradients, no Inter/system default, no glow dark-mode, no gradient text.
- Layout: asymmetric 12-col grid, generous rhythm, left-aligned editorial headlines, room vignettes, craftsmanship manifesto band.
- Motion (Awwwards standard, performant): Lenis smooth scroll, staggered hero mask-reveals (`ease-out-expo`), scroll parallax on stories, sliding cart drawer, hover image zoom, page transitions. Transform/opacity only. `prefers-reduced-motion` respected. 60fps budget.

### F2. Catalog + search
- Routes: `/`, `/shop`, `/product/[slug]`.
- Listing: search input (name/description/material), filters: room (Living/Bedroom/Dining/Bath/Decor/Outdoor), category (Furniture/Lighting/Textiles/Decor/Tableware), price range, in-stock toggle; sort: featured/newest/price asc/desc; pagination 24/page.
- Product page: gallery (Cloudinary), story, specs table (materials, dimensions, weight, care), stock badge, qty stepper, related products.
- SEO: unique slug, meta + JSON-LD Product, ISR 60s.
- Acceptance: 150 seeded products render <2.5s LCP on 4G, search returns in <300ms DB time.

### F3. Product data (rich Home & Living attrs)
Required per product: `slug, name, tagline, story (rich text), price_base_cents, stock, room, category, materials[], dimensions {w,d,h,unit}, weight_kg, care, images[] (Cloudinary URLs), active, featured, rating_seed (display only, no reviews V1)`.
- Prices are stored as integer `price_base_cents` against whichever currency row has `is_base=true`. No currency code is hardcoded in code or seed logic — seed just marks one row base.
- Images: 3–5 per product, `w_1200,q_auto,f_auto`, LQIP blur placeholder.
- Seed: realistic Nigerian + international names, plausible stock (0–40, some 0 for out-of-stock state).

### F4. Auth — Google-only shoppers (Better Auth) + separate email+password admin
- Shopper: Better Auth library, Google social provider only, `drizzleAdapter` (`provider: 'pg'`), sessions in Neon (`user/session/account/verification` tables generated via `npx @better-auth/cli generate`).
- `nextCookies()` plugin required so Server Actions see the session. Client via `createAuthClient()` (`signIn.social({ provider: 'google' })`).
- Single catch-all route `app/api/auth/[...auth]/route.ts` via `toNextJsHandler(auth)`. OAuth callback `/api/auth/callback/google`.
- Google Cloud Console: External consent + Web Client, origins `http://localhost:3000` + Vercel URL, redirect `<app>/api/auth/callback/google`.
- Middleware protects `/checkout`, `/orders/*` (shopper cookie), `/admin/*` (admin cookie — split gates, separate redirect targets `/login` vs `/admin/login`). `/login` shows single "Continue with Google" (no email/password for shoppers).
- Admin: a SECOND Better Auth instance (`lib/admin-auth.ts`, basePath `/api/admin-auth`, `cookiePrefix "admin"` → `admin.session_token`), email+password only, on isolated `admin_users/admin_sessions/admin_accounts/admin_verifications` tables (zero shared rows with shoppers). `/admin/login` (+ password reset) is public; `/admin/(protected)/*` requires the admin session. Brute-force throttle on credential endpoints. First-ever admin self-registers (bootstrap gate: zero rows); after that public sign-up is rejected — further admins via SQL/owner tooling. `ADMIN_EMAILS` is retired as an access gate (kept for mail routing only) — see ADR-021.
- Acceptance: guest hitting `/checkout` redirects to login + returns post-login; non-admin hitting `/admin` lands on `/admin/login`; shopper Google session never grants admin and admin session never grants shopper flows.

### F5. Cart
- Logged: `carts`/`cart_items` in Neon. Guest: localStorage. On login: merge guest → DB (sum qty, clamp to stock).
- Drawer + `/cart` page: qty steppers, remove, subtotal in selected currency, shipping estimate after zone select.
- Acceptance: refresh persists; stock clamp message when qty > stock.

### F6. Checkout — COD + Paystack (industry standard, honest totals)
- Form: contact (name prefilled, email prefilled locked to Google account, required phone for rider), address (country, state/region, city, street, postal, delivery-zone select), notes optional, currency select (from `currencies` table), **payment-method select (from `payment_methods` table — COD default)**, order review (lines + subtotal + zone fee + total), review-confirm modal, Place Order / Pay CTA.
- No card fields (Paystack collects card/bank details in its own inline popup). Phone validated (E.164-ish, min 7 digits). Zone required before submit so fee is explicit.
- COD path (`createOrder`, unchanged): session via Better Auth (`auth.api.getSession`) → load cart → re-price every line from `products` (ignore client totals; `expected*` snapshot comparison-only → `PRICE_CHANGED` re-confirm on drift) → validate stock → compute subtotal + zone fee in base currency → convert display total via `currencies.rate_to_base` but freeze `total_base_cents + currency_code + fx_rate_snapshot` on order → insert `orders + order_items` (`payment_method='cod'`, `payment_status='unpaid'`) → decrement stock → create `email_log` rows (buyer/seller/admin pending) → trigger notify (async, don't block response >2s).
- Paystack path (ADR-020): `initPaystackOrder` runs the SAME shared re-price (identical drift guarantee), then inserts the order as `awaiting_payment` with frozen totals + server-minted `PSK-` reference — no stock decrement, no cart clear, no mails. Shopper completes the inline popup; `verifyPaystackOrder` verifies server-to-server and asserts gateway `success` + kobo amount == order total, then finalizes (decrement stock atomically, `paid_online`/`paid`, queue mails, clear cart, notify). Webhook (`charge.success`, HMAC-checked, re-verified) covers the popup-closed/verify-never-ran case idempotently. Amounts are integer base minor units end-to-end (base NGN ⇒ cents == kobo 1:1). Paystack stays OFF in Admin → Settings until `PAYSTACK_SECRET_KEY` + public key land.
- Acceptance: tampered client price does not affect either path; oversell prevented (last-write wins with stock check); totals match admin zone table; killing the browser mid-popup leaves an `awaiting_payment` order with full stock and no mails; replaying a paid reference returns success without double-decrement.

### F7. Orders + lifecycle
- Shopper: `/orders`, `/orders/[id]` with timeline (COD rail: Placed → Confirmed → Out for delivery → Delivered + Paid; Paystack rail: Awaiting payment → Paid online → Confirmed → Out for delivery → Delivered) + totals snapshot + address snapshot + payment method.
- Admin: confirm, mark out-for-delivery, mark delivered+paid (COD only — prepaid orders never touch `paid_on_delivery`; `delivered` is terminal once paid), cancel (restocks; paid prepaid orders refund via Paystack → `refunded`, with manual-dashboard fallback).
- Statuses: `pending, awaiting_payment, paid_online, confirmed, out_for_delivery, delivered, paid_on_delivery (COD only, implies delivered), failed, cancelled, refunded`.
- Acceptance: cancel restores stock; delivered requires confirmed first (state machine enforced server-side); buyer-cancel stays 12h while no money is held (`pending` COD, `awaiting_payment`/`failed` prepaid) — paid orders go through support.

### F8. Currencies + shipping (both admin-driven, not code)
- `currencies(code PK, symbol, label, rate_to_base DECIMAL, is_base BOOL, active)` with exactly one `is_base=true`. Code never names a specific currency — it reads the base row at runtime. Product `price_base_cents` is always in base currency. Display = base / rate. Order freezes `currency_code + fx_rate_snapshot`.
- Seed inserts a sensible default set (e.g. NGN base + USD row); admin can flip `is_base`, add, or deactivate codes without deploy or env change.
- `shipping_zones(id, name e.g. Lagos / Nationwide / International, active)` + `shipping_rates(zone_id, min_subtotal_cents, fee_cents, eta_days)`. Checkout zone select reads live. Admin CRUD both.
- Acceptance: admin adds currency/zone without deploy; checkout reflects immediately; old orders keep snapshot totals.

### F9. Emails (provider-port, Mailgun sandbox now, swappable later)
- Email goes through a provider port: `lib/email/provider.ts` interface `{ send({to,subject,html,text}) }`, `lib/email/mailgun.ts` active impl, `lib/email/resend.ts` stubbed future impl, `lib/email/index.ts` factory by `EMAIL_PROVIDER=mailgun|resend`. Nothing outside `lib/email/` imports a vendor SDK.
- V1 provider = Mailgun in **sandbox mode** (no custom domain): sandbox domain + authorized test inbox only. All 3 order emails fan out to the authorized inbox in dev. Switching to a verified domain or to Resend later is config + provider impl only — no checkout/admin changes.
- One Route Handler `/api/orders/notify` (service key, idempotent by `orderId`): sends 3 types via the provider port:
  1. Buyer confirmation: order no, lines, totals in order currency, address, zone ETA, COD note ("pay on delivery, rider will call"), support contact. Luxury header/footer matching site.
  2. Owner fulfillment slip: buyer contact, full address + phone prominent, lines with SKUs/stock locations, totals, confirm CTA link.
  3. Admin digest: same + `email_log` status + site metrics link.
- Retry 3x exponential, log every attempt to `email_log(to, type, provider, provider_msg_id, status, error)`. Sandbox mode delivers to authorized recipients only.
- Acceptance: 1 order → 3 logs `sent` (to authorized inbox in sandbox); provider down → `pending` + retry cron/manual resend button in admin.

### F10. Admin dashboard
- `/admin/login` (email+password, isolated admin session) → `/admin`: KPI strip (pending count, low-stock, revenue COD collected), tabs: Products (table + CRUD modal + Cloudinary upload preset + active toggle), Orders (filter by status, detail drawer, action buttons incl. Paystack refund-on-cancel), Currencies, Zones/Rates, Payment methods (COD/Paystack toggle), Email log + Resend.
- All mutations server-side + admin session check (`getAdminSession` on the isolated instance — shopper sessions grant nothing). Audit via `updated_by`.
- Acceptance: non-admin hitting `/admin` lands on `/admin/login`; shopper Google login grants no admin access; every product/order/method mutation works without code deploy.

## 5. UX Requirements
- Mobile-first responsive, container queries for cards, critical CTA never hidden on mobile.
- Empty states teach (e.g. empty cart → "Explore Living Room icons" + CTA, not "nothing here").
- Forms: inline errors, optimistic qty, focus-visible, keyboard-navigable drawer/dialog.
- A11y AA: contrast ≥4.5:1 (tinted ink on paper passes), focus rings, alt text from product name + image index.

## 6. Non-Functional
- Perf: LCP <2.5s, CLS <0.1, image CDN transforms, ISR + `fetch` cache for catalog.
- Security: `DATABASE_URL` server-only, Mailgun key server-only, `BETTER_AUTH_SECRET` server-only; rate-limit `createOrder` (e.g. 10/min/IP); no client price trust.
- Cost: must stay within Neon 0.5GB + 100 CU-hrs/project/mo, Cloudinary free transforms, Mailgun ≤100/day. No paid add-ons. Drizzle `neon-http` per-request (no pool).
- Observability: `email_log` + Vercel logs; admin can resend failed emails.

## 7. User Journeys (happy paths)
1. **Guest → buyer (COD):** lands hero → Shop by Room → filters + search → product story → Add → drawer → Checkout (forced login) → Google → address + zone + currency + Cash on Delivery → review-confirm → Place → success + 3 emails → track in /orders.
2. **Guest → buyer (Paystack):** same to checkout → Pay now → review-confirm → inline popup → gateway charge → server verify (or webhook fallback) → `paid_online` + 3 emails → track in /orders with online-paid timeline.
3. **Admin restock:** `/admin/login` (email+password) → /admin/products → edit stock → active → visible immediately.
4. **Admin fulfill:** new order email → /admin/orders → Confirm → Out for delivery → Delivered(+Paid for COD) → buyer timeline updates. Paid online order cancelled → restock + Paystack refund → `refunded`.

## 8. Roadmap (build order)
M0 scaffold → M1 catalog+seed → M2 auth+roles → M3 cart+checkout → M4 emails → M5 admin settings → M6 polish/deploy/PR.

## 9. Risks
- Neon idle sleep (~300ms wake) — acceptable, warm via cron ping if needed.
- Mailgun DNS unverified → use sandbox authorized recipients until domain verified.
- Multi-currency rounding — always integer cents + snapshot rate; display rounding half-up.
- Free-tier pause/limits — monitor CU-hrs + storage in Neon dashboard.

## 10. Definition of Done (V1)
`pnpm build` clean, Drizzle migrations apply fresh, seed 150 (+ `cod` on / `paystack` off methods), Better Auth Google login → COD order → 3 branded emails logged `sent`, Paystack test charge → `paid_online` → 3 mails (webhook fallback proven by replay), admin email+password login → toggle Paystack on/off without deploy, admin can change price/currency/zone without deploy, Vercel preview URL green, PR `feature/shop-v1 → main` with PRD + architecture + decisions linked.

## 11. Change log
- 1.3 (2026-10-02): Paystack online alongside COD (F6 `payment_method` + init/verify/webhook + kobo integer + admin toggle, COD intact) + separate admin auth (F4 isolated instance/tables/cookies/routes, email+password, bootstrap, `ADMIN_EMAILS` retired as gate) + prepaid lifecycle rail (F7) + admin payment-methods/refund (F10). Linked `DECISIONS.md` ADR-020/ADR-021.
- 1.2 (2026-10-01): Currencies fully dynamic — dropped any code/env-specific currency (no `BASE_CURRENCY`; base resolved via `is_base`). Email via provider port (`EMAIL_PROVIDER`, Mailgun sandbox now, Resend-ready). Linked `DECISIONS.md`.
- 1.1 (2026-10-01): Auth.js → Better Auth library (drizzleAdapter pg, `nextCookies`, `[...auth]` route, `BETTER_AUTH_*` env). Drizzle `neon-http` confirmed as sole DB client. Linked `DECISIONS.md`.
- 1.0: initial PRD.

# PRD — Maison Editorial Shop (Home & Living)

- **Version:** 1.2 (locked for V1 build)
- **Status:** Approved for implementation
- **Store model:** Single store, physical goods, Cash on Delivery only
- **Catalog:** Large (~150 seed products), Home & Living
- **Design language:** Luxury editorial, Awwwards cinematic
- **Stack:** Next.js 15 + Neon Postgres + Drizzle (`neon-http`) + Better Auth (Google) + Cloudinary + Mailgun — see `DECISIONS.md` ADR-001–009
- **Worktree:** `../storefront-build` on branch `feature/shop-v1` (main stays clean)

---

## 1. Vision

A shop that feels like an interiors magazine that happens to sell. Editorial room stories, oversized serif headlines, warm paper surfaces — with a boringly reliable checkout underneath: Google login, live zone fees, admin-driven currencies, branded order emails.

No online payment in V1. COD only keeps costs at $0 and removes gateway risk.

## 2. Goals / Non-Goals

**Goals (V1 must):**
1. Browse 100s of Home & Living products with search, room/category filters, sort, pagination.
2. Google-only login (Better Auth library + Google Cloud Console) required to order.
3. Persistent cart (DB for logged users, localStorage merge on login).
4. Industry-standard COD checkout with live shipping-zone fee + admin-driven currency switch.
5. Server-validated orders (re-price from DB, stock check, transactional insert).
6. Branded Mailgun emails to buyer + owner/seller + admin on every order, with retry + log.
7. Admin dashboard: products CRUD + stock, orders lifecycle, currencies, shipping zones/rates.
8. $0 infra: Next.js on Vercel Free, Neon Free Postgres, Cloudinary Free, Mailgun Free 100/day.

**Non-Goals (explicitly out of V1):**
- Online payment (Paystack/Flutterwave/Stripe), discounts/coupons, reviews, wishlist, multi-vendor onboarding, multi-language, native apps.

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

### F4. Auth — Google-only (Better Auth)
- Better Auth library, Google social provider only, `drizzleAdapter` (`provider: 'pg'`), sessions in Neon (`user/session/account/verification` tables generated via `npx @better-auth/cli generate`).
- `nextCookies()` plugin required so Server Actions see the session. Client via `createAuthClient()` (`signIn.social({ provider: 'google' })`).
- Single catch-all route `app/api/auth/[...auth]/route.ts` via `toNextJsHandler(auth)`. OAuth callback `/api/auth/callback/google`.
- Google Cloud Console: External consent + Web Client, origins `http://localhost:3000` + Vercel URL, redirect `<app>/api/auth/callback/google`.
- Middleware protects `/checkout`, `/orders/*`, `/admin/*`. `/login` shows single "Continue with Google" (no email/password V1).
- First admin: `ADMIN_EMAILS` env allowlist. On first sign-in, if email in allowlist → `profiles.role='admin'`. No public promote endpoint and no `better-auth/admin` plugin in V1. Manual SQL promote as break-glass only.
- Acceptance: guest hitting `/checkout` redirects to login + returns post-login; admin email gets admin on first login.

### F5. Cart
- Logged: `carts`/`cart_items` in Neon. Guest: localStorage. On login: merge guest → DB (sum qty, clamp to stock).
- Drawer + `/cart` page: qty steppers, remove, subtotal in selected currency, shipping estimate after zone select.
- Acceptance: refresh persists; stock clamp message when qty > stock.

### F6. COD Checkout (industry standard)
- Form: contact (name prefilled, email prefilled locked to Google account, required phone for rider), address (country, state/region, city, street, postal, delivery-zone select), notes optional, currency select (from `currencies` table), order review (lines + subtotal + zone fee + total), Place Order CTA.
- No card fields. Phone validated (E.164-ish, min 7 digits). Zone required before submit so fee is explicit.
- Server action `createOrder`: session via Better Auth (`auth.api.getSession`) → load cart → re-price every line from `products` (ignore client totals) → validate stock → compute subtotal + zone fee in base currency → convert display total via `currencies.rate_to_base` but freeze `total_base_cents + currency_code + fx_rate_snapshot` on order → insert `orders + order_items` in transaction → decrement stock → create `email_log` rows (buyer/seller/admin pending) → trigger notify (async, don't block response >2s).
- Acceptance: tampered client price does not affect order; oversell prevented (last-write wins with stock check); totals match admin zone table.

### F7. Orders + lifecycle
- Shopper: `/orders`, `/orders/[id]` with timeline (Placed → Confirmed → Out for delivery → Delivered + Paid) + totals snapshot + address snapshot.
- Admin: confirm, mark out-for-delivery, mark delivered+paid, cancel (restocks). COD `paid_on_delivery` flag set only on delivered+paid.
- Statuses: `pending, confirmed, out_for_delivery, delivered, paid_on_delivery (implies delivered), cancelled`.
- Acceptance: cancel restores stock; delivered requires confirmed first (state machine enforced server-side).

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
- `/admin`: KPI strip (pending count, low-stock, revenue COD collected), tabs: Products (table + CRUD modal + Cloudinary upload preset + active toggle), Orders (filter by status, detail drawer, action buttons), Currencies, Zones/Rates, Email log + Resend.
- All mutations server-side + session + role check (`profiles.role='admin'`). Audit via `updated_by`.
- Acceptance: non-admin hitting `/admin` gets 403 + redirect; every product/order mutation works without code deploy.

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
1. **Guest → buyer:** lands hero → Shop by Room → filters + search → product story → Add → drawer → Checkout (forced login) → Google → address + zone + currency → Place → success + 3 emails → track in /orders.
2. **Admin restock:** login (allowlisted) → /admin/products → edit stock → active → visible immediately.
3. **Admin fulfill:** new order email → /admin/orders → Confirm → Out for delivery → Delivered+Paid → buyer timeline updates.

## 8. Roadmap (build order)
M0 scaffold → M1 catalog+seed → M2 auth+roles → M3 cart+checkout → M4 emails → M5 admin settings → M6 polish/deploy/PR.

## 9. Risks
- Neon idle sleep (~300ms wake) — acceptable, warm via cron ping if needed.
- Mailgun DNS unverified → use sandbox authorized recipients until domain verified.
- Multi-currency rounding — always integer cents + snapshot rate; display rounding half-up.
- Free-tier pause/limits — monitor CU-hrs + storage in Neon dashboard.

## 10. Definition of Done (V1)
`pnpm build` clean, Drizzle migrations apply fresh, seed 150, Better Auth Google login → COD order → 3 branded emails logged `sent`, admin can change price/currency/zone without deploy, Vercel preview URL green, PR `feature/shop-v1 → main` with PRD + architecture + decisions linked.

## 11. Change log
- 1.2 (2026-10-01): Currencies fully dynamic — dropped any code/env-specific currency (no `BASE_CURRENCY`; base resolved via `is_base`). Email via provider port (`EMAIL_PROVIDER`, Mailgun sandbox now, Resend-ready). Linked `DECISIONS.md`.
- 1.1 (2026-10-01): Auth.js → Better Auth library (drizzleAdapter pg, `nextCookies`, `[...auth]` route, `BETTER_AUTH_*` env). Drizzle `neon-http` confirmed as sole DB client. Linked `DECISIONS.md`.
- 1.0: initial PRD.

# Decisions — Maison Editorial Shop (Home & Living)

- **Version:** 1.4 (locked for V1)
- **Worktree:** `../storefront-build` on `feature/shop-v1`
- **Scope of this file:** decisions only. PRD lives in `PRD.md`, system design in `ARCHITECTURE.md`.
- **Rule:** any change to these decisions requires a new ADR entry + PRD/ARCH update. No silent drift.

---

## ADR-001 — Next.js App Router over Vite / TanStack Start

- **Decision:** Next.js 15 App Router + TypeScript + Tailwind on Vercel Free.
- **Why:** Shop needs SSR for product SEO, plus server actions / route handlers so order pricing and Mailgun keys stay server-side. Vite is client-only and would force a separate backend. TanStack Start can do the same but has thinner Supabase/Auth docs and deployment maturity.
- **Consequence:** One codebase owns UI + backend. All writes via server actions. No separate Express/Hono server.

## ADR-002 — Neon Postgres (prod) + Docker Postgres (dev)

- **Decision:** Neon-hosted Postgres for prod/deploy, local Docker Postgres 16 for dev. Same Drizzle `postgresql` dialect, same schema, same migrations; deploy is an env swap.
- **Why:** Neon dashboard was unreachable; Docker 29 available locally with no host Postgres. Docker gives isolated version-pinned dev with zero system installs. Neon stays for prod (100 projects, sleep-wake) with no code change.
- **Consequence:** `lib/db.ts` auto-switches driver (`neon-http` vs `postgres-js`) by URL; `docker-compose.yml` owns dev DB; Vercel env holds Neon URLs at deploy.

## ADR-003 — Drizzle + neon-http

- **Decision:** `drizzle-orm` with dual driver: `@neondatabase/serverless` (`neon-http`) for Neon URLs, `postgres` (`postgres-js`) for local TCP. No Prisma, no raw pg, no Supabase client.
- **Why:** `neon-http` only talks to Neon; local Docker needs TCP. One `db` export in `lib/db.ts` switches on `DATABASE_URL.includes('neon.tech')` with identical schema, so Better Auth adapter + all queries work in both environments.
- **Consequence:** All queries/actions go through Drizzle. Schema is single source of truth in `lib/db/schema.ts`.

## ADR-004 — Better Auth library over Auth.js v5

- **Decision:** `better-auth` npm library with `@better-auth/drizzle-adapter` (`provider: 'pg'`), Google social only in V1.
- **Why:** First-class Drizzle pg adapter, `nextCookies()` plugin makes sessions work inside Server Actions, single catch-all route via `toNextJsHandler(auth)`, less magic-string config than NextAuth. Self-hosted tables in `public` so app FKs work directly (not Neon Managed Auth `neon_auth` schema).
- **Auth shape:**
  - `lib/auth.ts`: `betterAuth({ database: drizzleAdapter, socialProviders: { google }, plugins: [nextCookies()] })`
  - `lib/auth-client.ts`: `createAuthClient()` for `signIn.social({ provider: 'google' })`, `useSession`, `signOut`
  - `app/api/auth/[...all]/route.ts`: `toNextJsHandler(auth)` (default basePath; `[...all]` preferred over `[...auth]` to avoid redirect_uri_mismatch)
  - Schema via `npx @better-auth/cli generate` then `drizzle-kit migrate`
  - Callback: `/api/auth/callback/google` — must be registered in Google Cloud Console
- **Roles:** keep `profiles.role` + `ADMIN_EMAILS` env allowlist auto-promote on sign-in. No `better-auth/admin` plugin in V1.
- **Consequence:** Google-login required for checkout/admin. Env uses `BETTER_AUTH_SECRET/URL` (not Auth.js names).

## ADR-005 — Cloudinary Free for images

- **Decision:** Cloudinary Free (CDN + transforms). No Neon storage, no Vercel Blob in V1.
- **Why:** Neon has no object storage. Cloudinary free gives `f_auto,q_auto` + fixed widths + blur placeholders, ideal for editorial imagery.
- **Consequence:** Admin uploads via signed preset, URLs stored in `products.images`. Delivery `w_400/800/1200`.

## ADR-006 — Manual COD checkout, no gateway

- **Decision:** Cash on Delivery only. No Paystack/Flutterwave/Stripe in V1.
- **Why:** $0 fees, no gateway accounts, fastest to ship. Server re-prices from DB and checks stock transactionally so client totals are never trusted.
- **Checkout fields (industry standard):** name (prefilled) + email (locked to Google) + required phone, country/state/city/street/postal, delivery-zone select (live fee), notes, currency select, review totals, Place Order.
- **Consequence:** Order stays `pending` until admin confirms; payment captured as `paid_on_delivery` only at delivery.

## ADR-007 — Admin-driven currencies + shipping zones (fully dynamic, no code/env currency)

- **Decision:** `currencies` and `shipping_zones/rates` are DB tables edited in `/admin`, never hardcoded and never in env. No `BASE_CURRENCY`. Exactly one `currencies.is_base=true`, resolved at runtime. Product stores `price_base_cents` against the base row; display converts via `rate_to_base`; order freezes `currency_code + fx_rate_snapshot` + totals.
- **Why:** User required dynamic multi-currency + per-zone fees without deploys or code-specific currency. Seed only inserts a sensible default set and marks one base; admin can flip `is_base`, add, or deactivate codes.
- **Shipping rule:** fee = first rate where `subtotal >= min_subtotal` for chosen zone (allows "free over X" via `fee_cents=0`).
- **Consequence:** Old orders keep snapshot totals even after admin flips base/rates. Code must never compare against a literal code (no `if code === 'NGN'`).

## ADR-008 — Single store, Google-login required, 3 emails via provider port, strict lifecycle

- **Decision:** Single store (seller notify = owner). Guest browses, must Google-login to order. Every order sends branded emails to buyer + owner + admin with retry + `email_log` (with `provider` column).
- **Email port:** `lib/email/provider.ts` interface, `lib/email/mailgun.ts` active (sandbox V1, no custom domain; authorized test inbox), `lib/email/resend.ts` stubbed future, `lib/email/index.ts` factory by `EMAIL_PROVIDER`. Nothing outside `lib/email/` imports a vendor SDK. Switching to Resend or a verified domain = provider impl + env only.
- **Lifecycle:** `pending → confirmed → out_for_delivery → delivered + paid_on_delivery | cancelled` (cancel restocks, enforced in `order-machine.ts`).
- **Consequence:** No multi-vendor onboarding in V1. Support resolves via `orders` + `email_log`.

## ADR-009 — Luxury editorial cinematic + V1 non-goals

- **Decision:** Luxury editorial direction: paper `#F6F1E8`, ink `#1A1714`, bronze accent, Fraunces display + grotesk body, asymmetric grid, Lenis smooth scroll, expo mask-reveals, parallax stories, drawer cart. Transform/opacity only, `prefers-reduced-motion` respected.
- **Non-goals V1:** no online payment, reviews, wishlist, coupons, multi-vendor, i18n.
- **Why:** Awwwards feel without perf debt; keeps V1 shippable on free tiers.
- **Consequence:** Motion budget enforced; no glow/gradient/card-spam patterns.

## ADR-010 — Curated Unsplash stock (hotlink now, Cloudinary fetch later)

- **Decision:** 156 products mapped to ~60 verified Unsplash furniture/home photo IDs by category + room (all HTTP-checked, ~30 spot-viewed; 5 off-subject rejects dropped). Hotlinked via `images.unsplash.com` (`remotePatterns`) until Cloudinary keys land, then Cloudinary `fetch` pulls the same URLs — no re-curation. `scripts/refresh-images.ts` recomputes images in place (orders/carts preserved).
- **Why:** Picsum randoms (e.g. windmills on a sofa) made the shop unreadable as finished. Unsplash License covers commercial demo use.
- **Consequence:** Demo-grade stock, not the boutique's own shots — final launch still needs real product photography. Footer discloses "photography shown is illustrative of each collection."

## ADR-011 — Maison brand chrome + contact identity

- **Decision:** "Maison" confirmed as the real shop name. Favicon SVG monogram + OG image + theme-color in `app/layout.tsx`; `SiteFooter` (brand, Shop links, delivery note, contact mailto) on every page. Contact = `OWNER_EMAIL` with `ADMIN_EMAILS[0]` fallback; mailto renders only when set — no invented address.
- **Consequence:** No logo shoot needed for V1; full identity pass (custom mark, domain) stays post-launch.

## ADR-012 — Phase 0 DRAFT business facts as placeholders (launch-blocking)

- **Decision:** Owner-approved realistic DRAFTs in `docs/BUSINESS_FACTS.md` (16 fields) unblock Phase 1; every DRAFT string ships visibly marked "pending verification" and is launch-blocking until replaced with verified facts.
- **Why:** HANDOFF §4 forbids agents inventing real facts, but Phase 1 trust shell (legal pages, contact, cancel window) cannot be built on empty values. DRAFTs let footer/checkout/emails/legal render honestly without presenting fiction as verified.
- **Consequence:** Prod launch requires real CAC, address/pickup, phone/WhatsApp ownership, support mailbox, domain DNS + sender verification, NDPR sign-off, ETA/fee ops sign-off, real photography or extended disclosure.

## ADR-013 — Shopper buyer-cancel: 12h pending-only with restock

- **Decision:** `cancelOrder` server action (owner-only, `pending` → `cancelled` via `canTransition`, within 12h of `createdAt`), restocks lines with conditional UPDATEs + compensate (no `db.transaction`), same pattern as admin cancel. UI: confirm-guarded button on `orders/[id]` for cancellable orders + policy links to `/returns` + `/contact`.
- **Why:** HANDOFF Phase 1 requires a buyer-cancel window + path; admin-only cancel left shoppers with no recourse. 12h pending-only balances rider-dispatch reality with buyer confidence for COD.
- **Consequence:** Expired/confirmed orders must go through support (admin `transitionOrder` unchanged). Window constant `BUYER_CANCEL_WINDOW_MS` is the single source.

## ADR-014 — Email reply-to + centralized contact identity

- **Decision:** `lib/contact.ts` owns trading name/CAC/address/phone/WhatsApp/hours/domain DRAFTs with `OWNER_EMAIL`/`ADMIN_EMAILS`/`SUPPORT_PHONE`/`WHATSAPP_URL`/`STORE_ADDRESS`/`STORE_HOURS` env overrides; `EmailSendInput.replyTo` plumbed through Mailgun `h:reply-to` (Resend stub inherits the field). Templates + footer + checkout + 6 legal pages read the same source; emails carry absolute `/shipping` `/returns` `/contact` links + phone/address/hours.
- **Why:** Replies must reach the shop, not the sandbox sender; contact previously lived in 3+ places with empty-state divergence (footer mailto hid, emails fell back to buyer address).
- **Consequence:** New optional env keys in `.env.example` (no secrets); prod domain swap remains provider impl + env only.

## ADR-015 — Contact single-source enforcement (reverses scattered contact reads)

- **Decision:** Every contact/URL surface reads `lib/contact.ts` — 9 import sites (6 legal pages + footer + checkout page + `lib/email/notify.ts`, which now uses `CONTACT` + `supportEmail()` + `appUrl()` instead of dynamic import + inline `APP_URL` fallback); templates gain `whatsappDisplay` alongside `whatsappUrl` (HTML + text footers). All env reads use `||`, never `??` (`SUPPORT_PHONE`, `APP_URL`/`NEXT_PUBLIC_APP_URL`, `ADMIN_EMAILS`, `MAILGUN_DOMAIN`) — empty-string env must fall back, not stick.
- **Why:** ADR-014 centralized the source but reads still diverged: `notify.ts` kept its own `APP_URL` fallback and dynamic contact import, and `??` let empty-string env masquerade as set (review failure §8.1). Scattered reads re-introduce the exact divergence ADR-014 killed.
- **Consequence:** New contact surface = new import of `lib/contact.ts`, no local fallback. Grep `?? ""` on every env read during review.

## ADR-016 — Honest checkout totals + review-confirm modal (reverses silent submit)

- **Decision:** Checkout no longer submits on form submit — it opens a review-confirm modal (`role="dialog"` `aria-modal`, Tab-trapped, Escape-closes, focus returns to opener) showing lines + subtotal + zone fee + total + address summary + policy links; only explicit confirm calls `createOrder`. Form state persists to `sessionStorage` (`checkout-draft-v1`, field allowlist, zone/currency validated against live lists) so Terms/Shipping/Returns/orders links never wipe it; draft clears on success. Expired sessions surface a dedicated `sessionExpired` re-login prompt, not the generic error.
- **Why:** One-click Place Order charged whatever the server computed at click time with no reviewed figure — any price/fee/rate drift between render and click was a silent charge. A modal forces a reviewed snapshot; the draft fixes the policy-link wipe that made shoppers retype.
- **Consequence:** Every `createOrder` call carries the reviewed `expected*` snapshot (ADR-017). Modal follows the `CancelOrderButton` focus pattern — copy it, don't reinvent.

## ADR-017 — PRICE_CHANGED re-confirm (new; server never trusts the snapshot)

- **Decision:** `checkoutSchema` accepts optional `expectedSubtotalBaseCents` / `expectedShippingBaseCents` / `expectedTotalBaseCents` / `expectedRateToBase`; `createOrder` re-prices from the DB as before and, when any `expected*` is present and differs (subtotal, fee, total, or FX rate — numeric compare with string fallback), returns `{ ok:false, code:"PRICE_CHANGED", old, new }` instead of charging. The client adopts the server snapshot as the shown figure everywhere and re-confirms in-modal; zone/currency edits invalidate the last server price. `expected*` is comparison-only — charge basis stays server values.
- **Why:** Honest totals (ADR-016) need a drift protocol: admin price/fee/rate edits between review and confirm must surface as re-confirm, not silent charge and not hard error. Returning old/new lets the shopper see exactly what moved.
- **Consequence:** PRD F6 / ARCH §5 unchanged (server re-price, client never trusted) — this only names the drift branch. Idempotent token replays redirect WITHOUT `?new=1` so a double-submit never shows a fresh thank-you.

## ADR-018 — Admin shell separation (reverses shared storefront chrome)

- **Decision:** `SiteChrome` (client, `usePathname`) renders bare `{children}` on `/admin/*` — no shopper `SiteHeader`/`SiteFooter`/`CartDrawer`/`CartMerge`; admin owns its shell via `admin/layout.tsx` + `AdminNav` (client, `aria-current="page"` on the active tab). Root `layout.tsx` delegates all chrome to `SiteChrome`.
- **Why:** Shared chrome leaked shopper navigation, footer and cart drawer into the shop-team tool and confused both audiences. Admin is a tool, not a store page — it needs density and its own nav, not marketing chrome.
- **Consequence:** New shopper chrome must mount inside the non-admin branch of `SiteChrome`, never directly in root layout. Admin pages stay `force-dynamic` behind the existing role gate.

## ADR-019 — Visual folio system (new; single editorial source)

- **Decision:** `components/storefront/Editorial.tsx` owns all ornaments — `MotifMark` (four-point hairline star), `Folio` (`N°` + rule + label), `ChapterHeading`, `CatalogInterlude`, `EmptyState` — consumed across 12 files (hero, rails, grids, PDP, login, 404, orders). Supporting moves: hero object (arched figure, offset bronze frame, Fig. caption, ledger-stats row replacing stat cards); `ProductCard` anti-monotony rhythm (`index`-driven 4/3 vs 4/5 ratio + folio numbers); `animate-ticker` + `ticker-mask` (transform-only) + `story-dropcap` in `globals.css`; `StripNewParam` one-shot thank-you; shop interlude break after the 6th card; empty states teach with room pointers.
- **Why:** Phase 3 elevation without a shared source would drift into per-page ornament dialects. One module keeps hero, rails, grids and rituals rhyming; constraints (ink/bronze on paper, no gradients/glow/gradient-text, transform/opacity-only motion, `prefers-reduced-motion`) are enforced once.
- **Consequence:** New ornament = new export in `Editorial.tsx`, not a local one-off. PDP/hero imagery stays Unsplash illustrative per ADR-010 until the real shoot.

## ADR-020 — Paystack online alongside COD (verify-before-decrement, webhook fallback, kobo integer, admin toggle)

- **Decision:** Paystack inline-popup online payment ships alongside COD, off by default. `payment_methods` table (`cod` on / `paystack` off seeded; `setPaymentMethodEnabled` allowlists `cod|paystack`) with an admin Settings toggle (`PaymentMethodForm`, `role="switch"`); checkout offers only enabled methods and `getPaymentMethodsSafe` falls back to COD-only when the table is unmigrated. Orders gain `payment_method` (`cod|paystack`, default `cod`), `payment_status` (`unpaid|awaiting|paid|failed|refunded`), `paystack_ref` (unique), `paid_at`, `paystack_auth` jsonb (`last4/brand/channel`).
- **Flow (verify-before-decrement):** `initPaystackOrder` re-uses the shared re-price (same `expected*`/`PRICE_CHANGED` honest-price guarantee as COD) and creates the order as `awaiting_payment` with frozen totals + server-minted ref (`PSK-<orderNo>-<8 random>`) — WITHOUT decrementing stock, clearing the cart, or queueing mails. The browser opens Paystack inline (`NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `PAYSTACK_INLINE_JS`) and returns the ref; `verifyPaystackOrder` confirms server-to-server (`GET /transaction/verify/:ref`, secret bearer), asserts `status == success` AND `amountKobo == totalBaseCents`, then `finalizePaidOrder` (atomic conditional decrements; stockout → `failed` + `paymentStatus paid` with restocked partials so the refund path stays open; idempotent on same ref; queues the 3 mails + clears the cart + fires notify only now). Webhook `POST /api/payments/paystack/webhook` is the fallback: raw-body HMAC-SHA512 check (Web Crypto, no node imports so the module stays client-safe for the confirm modal), `charge.success` only, then re-verifies server-to-server before finalizing — the event is a hint, verify is the truth; already-`paid_online`/unknown refs ack 200, signature/infra failures return 4xx/5xx so Paystack retries.
- **Kobo integer:** `PAYSTACK_CURRENCY = NGN`; the base currency is NGN so base cents == kobo 1:1 (`baseCentsToKobo` is an identity with a positive-integer guard — fractional totals can never reach the gateway). The frozen FX snapshot is the only conversion basis, never a live rate.
- **Lifecycle/refund:** order-machine gains a prepaid rail (`awaiting_payment → paid_online → confirmed → … → delivered`; `failed`/`refunded` prepaid-only leaves; `paid_on_delivery` blocked for prepaid via `canTransition(from, to, paymentMethod)`; buyer-cancel extends to `awaiting`/`failed` within 12h since no money is held). Admin cancel of an unpaid prepaid order restocks nothing (nothing was decremented) and marks `cancelled/failed`; cancel of a paid prepaid order restocks + attempts `POST /refund {transaction: ref}` → `refunded`, with `MANUAL_REFUND`/`REFUND_FAILED` fallbacks (restocked + `cancelled/paid`, refund in the Paystack dashboard).
- **Why:** COD-only capped conversion and the owner scope explicitly added Paystack. Decrement-on-verify (not on init) keeps riders from chasing unpaid stock; webhook covers the popup-closed/verify-never-ran hole; integer kobo avoids the multi-currency rounding class entirely.
- **Consequence:** `createOrder` (COD) is untouched — same re-price, same atomic stock, same mails. `checkoutSchema` gains `paymentMethod` (`cod|paystack`, default `cod`) + `paystackReference` (conditional: a ref on `cod` is rejected). Until `PAYSTACK_SECRET_KEY` + public key land, keep Paystack OFF in Admin → Settings.

## ADR-021 — Separate admin auth (isolated tables/instance/cookies/routes, email+password, bootstrap, ADMIN_EMAILS retired)

- **Decision:** Admin auth is a fully separate Better Auth instance (`lib/admin-auth.ts`), isolated from shopper auth (`lib/auth.ts`) on every axis: basePath `/api/admin-auth` (shopper stays `/api/auth`), email+password only (no social), `cookiePrefix "admin"` (`admin.session_token`, never collides with `better-auth.session_token`), and physically separate tables `admin_users/admin_sessions/admin_accounts/admin_verifications` via `drizzleAdapter` schema mapping — zero shared rows. Routes: public `/admin/login` + `/admin/login/reset`, protected `/admin/(protected)/*` behind `getAdminSession`/`requireAdmin` (`lib/auth-session.ts`); middleware splits Edge cookie-presence gates (admin cookie → `/admin/login`, shopper cookie → `/login`). Brute-force throttle via Better Auth `rateLimit` customRules (sign-in 5/min, sign-up + reset 3/min). Bootstrap: the very first admin self-registers (`databaseHooks` count==0 gate; count failure fails closed, and once one admin exists public sign-up is rejected — further admins via SQL/owner tooling). Password reset via `sendResetPassword` (reset URL logged server-side until admin mail is wired; `revokeSessionsOnPasswordReset` on). Admin client is `lib/admin-auth-client.ts` (`/api/admin-auth`), never the shopper client.
- **Why:** The `ADMIN_EMAILS` auto-promote model (ADR-004) tied shop-team access to shopper Google identities and a deploy-touching env allowlist, with no password/reset story and no brute-force story. A tool audience needs credentials + throttle + reset, on sessions that can never resolve to shopper rows.
- **Consequence:** `ADMIN_EMAILS` is RETIRED as an access gate — `getSessionProfile` no longer promotes and always upserts `customer`; the break-glass SQL promote goes with it. `ADMIN_EMAILS` REMAINS for mail routing (admin digest + `supportEmail()` fallback + queued mails), so it stays in `.env.example` with no values. Shopper flows (Google login, checkout, orders, cart) are unchanged.

---

## Env implications (summary, details in ARCHITECTURE.md)

```
DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL,
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
CLOUDINARY_*, EMAIL_PROVIDER=mailgun, MAILGUN_* (sandbox domain, no DNS), TEST_INBOX, RESEND_API_KEY (future),
OWNER_EMAIL, ADMIN_EMAILS (mail routing only — retired as access gate per ADR-021), NOTIFY_SECRET,
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY (browser) + PAYSTACK_SECRET_KEY (server-only verify/refund/webhook) + optional PAYSTACK_PUBLIC_KEY override (ADR-020)
```
No `BASE_CURRENCY` — base is the `currencies` row with `is_base=true`.

## Change log

- 2026-10-02: v1.4 — Paystack online alongside COD (ADR-020: verify-before-decrement, webhook fallback, kobo integer, admin toggle) + separate admin auth (ADR-021: isolated instance/tables/cookies/routes, email+password, bootstrap, ADMIN_EMAILS retired as gate). PRD 1.3 / ARCH 1.3 extended, COD intact.
- 2026-10-02: v1.3 — Phase 1–4 calls: contact single-source enforcement (ADR-015), honest totals + confirm modal (ADR-016), PRICE_CHANGED re-confirm (ADR-017), admin shell separation (ADR-018), visual folio system (ADR-019). PRD/ARCH unchanged (no drift).
- 2026-10-01: v1.2 — curated Unsplash photography mapped per category/room (ADR-010), Maison brand chrome + footer + contact identity (ADR-011). Aligned with PRD 1.2 / ARCH 1.2.
- 2026-10-01: v1.1 — currencies fully dynamic (no `BASE_CURRENCY`); email via provider port (Mailgun sandbox V1, Resend-ready). Aligned with PRD 1.2 / ARCH 1.2.
- 2026-10-01: v1.0 created (decisions-only step, no code).

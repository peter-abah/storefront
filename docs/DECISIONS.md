# Decisions — Maison Editorial Shop (Home & Living)

- **Version:** 1.2 (locked for V1)
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

---

## Env implications (summary, details in ARCHITECTURE.md)

```
DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL,
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
CLOUDINARY_*, EMAIL_PROVIDER=mailgun, MAILGUN_* (sandbox domain, no DNS), TEST_INBOX, RESEND_API_KEY (future),
OWNER_EMAIL, ADMIN_EMAILS, NOTIFY_SECRET
```
No `BASE_CURRENCY` — base is the `currencies` row with `is_base=true`.

## Change log

- 2026-10-01: v1.2 — curated Unsplash photography mapped per category/room (ADR-010), Maison brand chrome + footer + contact identity (ADR-011). Aligned with PRD 1.2 / ARCH 1.2.
- 2026-10-01: v1.1 — currencies fully dynamic (no `BASE_CURRENCY`); email via provider port (Mailgun sandbox V1, Resend-ready). Aligned with PRD 1.2 / ARCH 1.2.
- 2026-10-01: v1.0 created (decisions-only step, no code).

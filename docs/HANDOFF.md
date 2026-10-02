# Handoff — Maison Editorial Shop (Home & Living)

> **To continue in a new session, the only prompt needed is:**
>
> Continue the Maison shop from `docs/HANDOFF.md` in worktree `../storefront-build` (`feature/shop-v1`). Start with Phase 0 intake.
>
> Then: re-verify health (§1), read the program phase in scope, and work it. This file plus `PRD.md` / `ARCHITECTURE.md` / `DECISIONS.md` is the full context — chat history is not a record.

---

## 1. State snapshot (2026-10-02 — Phase 0 DRAFT intake done, Phase 1 in progress)

- **Worktrees:** `/home/peter/code/projects/hng-15/storefront` (`main`, ~empty) + `/home/peter/code/projects/hng-15/storefront-build` (`feature/shop-v1`, ALL work, **uncommitted**). Never commit unless explicitly asked. Final step one day: PR `feature/shop-v1 → main`.
- **Live services:** local Docker Postgres `maison-db` (Postgres 16, `maison:maison@localhost:5432/maison`, healthy). DB re-verified 2026-10-02: 156 products, 3 currencies (NGN base/active + USD active + GHS inactive), 3 shipping zones (Lagos 2 rates / Nationwide 2 / International 1 = 5 rates). One real test order may exist — never blind-truncate `products`.
- **Secrets:** `storefront-build/.env.local` (gitignored, never print values). Mailgun sandbox verified active; Google OAuth + allowlist set; **Cloudinary keys missing** (deferred); Neon untouched (local Docker for dev, Neon at deploy).
- **Docs versions:** `PRD.md` v1.2, `ARCHITECTURE.md` v1.2, `DECISIONS.md` v1.2 (ADRs 001–011) + `BUSINESS_FACTS.md` DRAFT (Phase 0, 16 fields, all marked DRAFT launch-blocking).
- **Built & verified (Waves 1–6 + C + photos + brand):** catalog (search/filter/sort, 24/page), cart (DB + guest merge + drawer), COD checkout (server re-price, idempotent `clientToken`, atomic stock, no `db.transaction`), orders + timeline, Google-only login, **sandbox emails proven delivered 3/3** (fixtures cleaned), full admin (products/orders/currencies/zones/email-log), 61 copy fixes, curated Unsplash photos per category/room (59 IDs verified, ~30 visually inspected, 5 off-subject rejects dropped), favicon/OG/footer/contact. Verified: green builds, 320px zero-overflow scans, ₦ formatting, auth gates redirect correctly.

## 2. Decisions index (see DECISIONS.md for full ADRs)

Next.js 15 + Neon(prod)/Docker-dev + Drizzle `neon-http`/`postgres-js` auto-switch + Better Auth (Google shoppers) + Cloudinary + Mailgun sandbox behind swappable `lib/email/` port + Vercel. Single store, COD-only, **Google forced — no guest checkout** (conversion tradeoff accepted; justify honestly at checkout). Admin-driven currencies/zones, no `BASE_CURRENCY`. **Admin gets a SEPARATE email login; first-ever login bootstraps the initial admin** (replaces `ADMIN_EMAILS` allowlist; needs distinct session cookies + brute-force throttle + reset-via-email). Scope: **full polish program**. Mobile standard: **320px**. Photos: Unsplash hotlink now, Cloudinary `fetch` later (footer discloses illustrative). Brand "Maison" is real.

## 3. The program

- **Phase 0 — Business fact intake. DONE (DRAFT 2026-10-02).** Owner approved realistic DRAFT placeholders in `docs/BUSINESS_FACTS.md` (16 fields, all DRAFT launch-blocking). Currency confirmed admin-driven per ADR-007 (no code/env change). Real values still required before prod launch — see BUSINESS_FACTS launch blockers.
- **Phase 1 — Trust shell (launch-blocking). IN PROGRESS.** Legal pages (shipping/returns/terms/privacy/FAQ/contact) wired from footer + checkout + emails; real contact/WhatsApp identity everywhere; custom email domain + reply-to; prod URLs (no localhost); buyer-cancel window + path. Built on Phase 0 DRAFTs — every DRAFT string ships with launch-blocker status.
- **Phase 2 — UX repairs (user's 8 + 48-friction audit, P0 first).** Drawer-close/merge/callbackURL loop; honest checkout totals + review-confirm; destructive-action guards (hide product, cancel+restock, delete rate); silent-state-loss ends (hidden-product removals, expired-session prompt, storage-full, one-shot `?new=1`); clickable order rows; product edit **pages** (not modal) + image previews; mobile card lists for tables; separate admin shell + staff gate; keyboard/focus/ARIA pass. Checkout sentence: **delete**, don't rewrite. Copy-lint every new string.
- **Phase 3 — Visual elevation.** Hero object, motif/folio system, broken card monotony, PDP narrative specs, RoomRail elevation, header ticker + footer moment, checkout-success ritual, login/empty-state rescue.
- **Phase 4 — Copy voice pass.** Warmth/consistency sweep on all Phase 1–3 strings (same banned-term gate).
- **Phase 5 — Verification with teeth.** Every route rendered 320/390/1440 with screenshots attached; result **counts** asserted (never status-only); interactions proven (drawer closes, rows open, zero overflow); banned-term + AI-slop checklists green.

## 4. Business-facts intake sheet (owner supplies — agents never invent)

Sheet captured as DRAFT in `docs/BUSINESS_FACTS.md` (2026-10-02, owner-approved placeholders, all launch-blocking). Original required fields: legal trading name + CAC; Lagos address + pickup?; phone + WhatsApp; support email; hours. Real zones/fees/ETAs + free-over threshold + rider behavior (carry-in? assembly? change policy?). Returns/cancellation window + remedy + return freight + refund timeline + request path. Terms/privacy sign-off (NDPR: data kept, retention, deletion path). About story. Domain + sender mailboxes + DNS access. Real photography plan. Base currency decision is NGN unless stated (confirmed admin-driven, ADR-007).

## 5. Gotchas log (hard-won — do not relearn)

1. `Number("")` is `0` — blank price inputs once wiped the catalog. Reviews assert rendered **counts**, never status-only.
2. `gap-8` on `editorial-grid` collapses 1fr tracks at 320px (11×32px gutters > 288px container). The utility owns the gap — see `globals.css` comment.
3. `db.transaction` forbidden (neon-http). Atomic conditional UPDATEs + compensate instead.
4. Bare `.returning()` only (neon-http typings reject column args).
5. Empty-string env defeats `??` — use `||` for env fallbacks (`drizzle.config.ts` pattern).
6. `@better-auth/cli` npm tag is stale (1.4.x) — generate schema via `npx auth@latest generate`.
7. Incremental builds flake on stale `.next` (`pages-manifest.json ENOENT`) — `rm -rf .next` and rebuild.
8. `pkill -f` matches its own shell — kill Next servers by PID.
9. `Intl.NumberFormat("en", {currency:"NGN"})` renders the code — use per-code locales (`en-NG` → ₦) with symbol fallback.
10. Orchestration that works: implement agent → **separate** review agent → fix → verify (build + renders + counts + clicks). Structural checks alone ship toy-grade defects.
11. `"use server"` files cannot export non-async values (constants/helpers) — build fails "Server Actions must be async". Keep `BUYER_CANCEL_WINDOW_MS` / `isBuyerCancellable` in `lib/order-machine.ts`, import into actions + pages.
12. Client components cannot use `<a href="/…">` for internal nav (`no-html-link-for-pages`) — use `next/link` even for legal links in `CheckoutForm`.

## 7. Phase 1 verification evidence (2026-10-02, uncommitted)

- `pnpm build` green (24s compile, 15 static/dynamic routes). 6/6 legal routes present (`shipping/returns/terms/privacy/faq/contact`) vs 0 before; footer carries 6/6 help links; checkout review carries Terms/Shipping/Returns + orders links.
- Counts (not status-only): `ls -d app/{shipping,returns,terms,privacy,faq,contact} = 6`; footer legal `href` count = 6; checkout trust links = 4; `replyTo|h:reply-to` refs in `lib/email/` = 4; cancel wired across 4 files (`order-machine`, `actions/orders`, `CancelOrderButton`, `orders/[id]`).
- Trust deltas: `lib/contact.ts` single identity source (DRAFT, env-overridable); `metadataBase` + canonical + OG siteName/url + robots in `layout.tsx`; emails carry support phone/address/hours + absolute shipping/returns/contact URLs + reply-to; buyer-cancel 12h pending-only with restock + confirm guard + policy links.
- Still DRAFT launch-blocking: all identity/policy/photo values per `BUSINESS_FACTS.md`; sandbox sender until domain DNS verified; localhost `APP_URL` fallback dev-only. No commit made.

## 6. Agent documentation discipline (binding, every session)

1. **Decisions** → `docs/DECISIONS.md` as new ADR entries (numbered, why + consequences) the same day — including reversed calls and why.
2. **Plans** → this file (phases, entry criteria, done-gates); update phase status as work completes, never leave stale phases.
3. **Process + anything of note** → append here: gotchas hit, review failures + root causes, verification evidence, deviations with justification.
4. **No session ends with undocumented state.** Flush decisions, plans, and notes to `docs/` before stopping. Chat history is not a record — a new session must continue from the one-line prompt alone.
5. **Enforcement:** review gates check documentation currency with the same weight as code gates. Stale docs = failed gate.

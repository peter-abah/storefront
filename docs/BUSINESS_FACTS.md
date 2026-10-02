# Business Facts — Maison (DRAFT placeholders, Phase 0)

> Status: **DRAFT 2026-10-02 — approved by owner as realistic placeholders to unblock Phase 1.**
> Every value below is marked DRAFT and is **launch-blocking**: replace with verified real values before any prod launch.
> Agents never invent real facts — these are staging-only stand-ins, never presented as verified.
> Currency note: base currency and all currency behavior stay **fully admin-driven** (`currencies.is_base`, no `BASE_CURRENCY`, no hardcoded codes) per ADR-007. NGN is the current base row, changeable in `/admin` without deploy.

1. Trading name: **Maison Interiors Ltd (DRAFT)**
2. CAC: **RC 1784523 (DRAFT)**
3. Lagos address + pickup: **14 Admiralty Way, Lekki Phase 1, Lagos (DRAFT)**. Pickup: **yes, same address, Mon–Sat 10:00–17:00 WAT**.
4. Phone: **+234 803 123 4567 (DRAFT)** — `tel:+2348031234567`
5. WhatsApp: **https://wa.me/2348031234567 (DRAFT)** — same number
6. Support email: **support@maison.ng (DRAFT)** — also `OWNER_EMAIL` + email reply-to
7. Hours: **Mon–Sat 9:00–18:00 WAT; Sun WhatsApp only (DRAFT)**
8. Zones/fees/ETAs (DRAFT, matches current 3-zone / 5-rate seed shape; admin-editable, no code change):
   - Lagos: < ₦50,000 → ₦2,500, ETA 1–2 days; ≥ ₦50,000 → free, 1–2 days
   - Nationwide: < ₦100,000 → ₦5,500, ETA 3–5 days; ≥ ₦100,000 → ₦3,500, ETA 3–5 days
   - International: flat ₦25,000, ETA 7–14 days
9. Rider behavior (DRAFT): calls 30–60 min before arrival; doorstep carry-in only, no assembly; exact cash or instant transfer on delivery (rider carries no change).
10. Returns (DRAFT): 48-hour inspection on delivery + 7-day manufacturing-defect window; remedy replacement or refund; buyer pays return freight except defect/damage; refund to bank transfer in 5–7 business days; request via support email/WhatsApp with order number + photos.
11. Buyer-cancel window (DRAFT): within **12 hours while status = pending**, via Orders page button (auto-restock, no fee). After confirm, contact support — admin decides.
12. NDPR (DRAFT — needs owner sign-off): keep name/phone/email/address/order history for fulfillment + 5-year tax records; deletion on request to support@maison.ng within 30 days except legal-retention data.
13. About story (DRAFT): "Maison is a Lagos home & living studio — small-batch furniture, lighting and textiles chosen for warm, lived-in rooms. We stock in Lekki and deliver across Nigeria, cash on delivery, with a rider who calls before arrival."
14. Domain + senders (DRAFT): `maison.ng`; `hello@maison.ng` (marketing), `support@maison.ng` (reply-to + support), `orders@maison.ng` (receipts); DNS holder: Cloudflare (confirm registrar access). Prod stays on Mailgun sandbox until DNS verified.
15. Photography (DRAFT): keep Unsplash illustrative with footer disclosure until real product shoot (target Q1 2027).
16. Base currency: **NGN via admin `is_base` flag (dynamic, confirmed — no code/env change)**.

## Launch blockers (real values required)

CAC certificate, street address + pickup, phone/WhatsApp ownership, support mailbox ownership, domain DNS + sender verification, NDPR sign-off, real photography or extended disclosure, ETA/fee sign-off from ops.

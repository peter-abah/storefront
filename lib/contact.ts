// Central shop contact identity — Phase 1 trust shell.
// Values are Phase 0 DRAFT placeholders (docs/BUSINESS_FACTS.md), all
// launch-blocking. Env overrides email/phones when set; hardcoded fallbacks
// are the owner-approved DRAFTs so footer/checkout/emails never render empty
// in dev, but MUST be replaced with verified facts before prod launch.
//
// Currency note: nothing currency-related lives here — currencies/zones are
// fully admin-driven (ADR-007), no BASE_CURRENCY, no hardcoded codes.

const DRAFT = {
  tradingName: "Maison Interiors Ltd",
  cac: "RC 1784523",
  address: "14 Admiralty Way, Lekki Phase 1, Lagos",
  pickupNote: "Pickup available Mon–Sat 10:00–17:00 WAT, same address",
  phoneDisplay: "+234 803 123 4567",
  phoneHref: "tel:+2348031234567",
  whatsappUrl: "https://wa.me/2348031234567",
  whatsappDisplay: "WhatsApp +234 803 123 4567",
  supportEmail: "support@maison.ng",
  hours: "Mon–Sat 9:00–18:00 WAT; Sun WhatsApp only",
  domain: "maison.ng",
} as const;

function envOr(fallback: string, ...names: string[]): string {
  for (const n of names) {
    const v = process.env[n]?.trim();
    if (v) return v;
  }
  return fallback;
}

export const CONTACT = {
  tradingName: DRAFT.tradingName,
  cac: DRAFT.cac,
  address: envOr(DRAFT.address, "STORE_ADDRESS"),
  pickupNote: DRAFT.pickupNote,
  phoneDisplay: envOr(DRAFT.phoneDisplay, "SUPPORT_PHONE"),
  phoneHref:
    (process.env.SUPPORT_PHONE?.trim() || "") !== ""
      ? `tel:${process.env.SUPPORT_PHONE!.replace(/[^+\d]/g, "")}`
      : DRAFT.phoneHref,
  whatsappUrl: envOr(DRAFT.whatsappUrl, "WHATSAPP_URL"),
  whatsappDisplay: DRAFT.whatsappDisplay,
  hours: envOr(DRAFT.hours, "STORE_HOURS"),
  domain: DRAFT.domain,
} as const;

/** Support email: OWNER_EMAIL first, then ADMIN_EMAILS[0], then DRAFT. Never empty in dev. */
export function supportEmail(): string {
  return (
    process.env.OWNER_EMAIL?.trim() ||
    process.env.ADMIN_EMAILS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean)[0] ||
    DRAFT.supportEmail
  );
}

/** App URL for absolute links (emails, metadata). Localhost fallback is dev-only. */
export function appUrl(): string {
  return (
    (process.env.APP_URL || "").trim() ||
    (process.env.NEXT_PUBLIC_APP_URL || "").trim() ||
    "http://localhost:3000"
  );
}

export const IS_DRAFT_IDENTITY = true;

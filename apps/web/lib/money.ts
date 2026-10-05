// Pure money helpers — safe for BOTH server and client components.
// (lib/queries/products.ts re-exports these; it additionally owns the
// DB-backed getDisplayCurrency which must never ship to the browser.)
export type MoneyCurrency = {
  code: string;
  symbol: string;
};

/**
 * Convert base-minor units → display-minor units with half-up rounding.
 * Display = round(base / rate_to_base). rate_to_base = base units per 1
 * display unit (e.g. base NGN: NGN rate 1, USD rate 1500).
 */
export function toDisplay(baseCents: number, rateToBase: string | number): number {
  const rate = Number(rateToBase);
  if (!Number.isFinite(rate) || rate <= 0) return Math.round(baseCents);
  return Math.round(baseCents / rate);
}

const LOCALE_FOR_CODE: Record<string, string> = {
  NGN: "en-NG", // renders ₦ (plain "en" falls back to the "NGN" code)
  USD: "en-US",
  GHS: "en-GH",
};

export function formatDisplay(displayCents: number, currency: MoneyCurrency): string {
  const major = displayCents / 100;
  try {
    return new Intl.NumberFormat(LOCALE_FOR_CODE[currency.code.toUpperCase()] ?? "en", {
      style: "currency",
      currency: currency.code,
      maximumFractionDigits: major < 100 ? 2 : 0,
    }).format(major);
  } catch {
    return `${currency.symbol}${major.toLocaleString("en")}`;
  }
}

/** One-liner: base cents → formatted string in the given currency. */
export function formatPrice(baseCents: number, currency: MoneyCurrency & { rateToBase: string | number }): string {
  return formatDisplay(toDisplay(baseCents, currency.rateToBase), currency);
}

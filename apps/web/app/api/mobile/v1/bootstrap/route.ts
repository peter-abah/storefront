import { eq } from "drizzle-orm";
import type { MobileBootstrapDTO } from "@maison/shared";
import { db } from "@/lib/db";
import { shippingRates, shippingZones } from "@/lib/db/schema";
import { getActiveCurrencies } from "@/lib/actions/cart";
import { getPaymentMethodsSafe } from "@/lib/payments";
import { paystackPublicKey } from "@/lib/paystack";
import { CONTACT } from "@/lib/contact";
import { supportEmailAsync } from "@/lib/admin-emails";
import { jsonOk, preflight } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * GET /api/mobile/v1/bootstrap — public cold-start payload: currencies +
 * checkout context (mirrors apps/web/app/checkout/page.tsx:31-75,134-135) +
 * contact identity. When zones/currencies are not configured yet this still
 * returns 200 with empty arrays and `defaultCurrencyCode: ""`; the client
 * decides how to surface "shop not configured" (same as the checkout page's
 * empty-state branch, just without blocking the rest of the app payload).
 */
export async function GET(req: Request) {
  const [currencyRes, zoneRows, rateRows, methodRows, email] =
    await Promise.all([
      getActiveCurrencies(),
      db.select().from(shippingZones).where(eq(shippingZones.active, true)),
      db.select().from(shippingRates),
      getPaymentMethodsSafe(),
      supportEmailAsync(),
    ]);

  const zones = zoneRows.map((z) => ({
    id: z.id,
    name: z.name,
    rates: rateRows
      .filter((r) => r.zoneId === z.id)
      .map((r) => ({
        minSubtotalCents: r.minSubtotalCents,
        feeCents: r.feeCents,
        etaDays: r.etaDays,
      }))
      .sort((a, b) => a.minSubtotalCents - b.minSubtotalCents),
  }));

  const boxedCurrencies = currencyRes.data.map((c) => ({
    code: c.code,
    symbol: c.symbol,
    label: c.label,
    rateToBase: c.rateToBase,
    isBase: c.isBase,
  }));

  const defaultCurrency =
    boxedCurrencies.find((c) => c.isBase) ?? boxedCurrencies[0];

  const data: MobileBootstrapDTO = {
    currencies: currencyRes.data,
    checkout: {
      zones,
      currencies: boxedCurrencies,
      defaultCurrencyCode: defaultCurrency?.code ?? "",
      paymentMethods: methodRows,
      paystackPublicKey: paystackPublicKey(),
    },
    contact: {
      email,
      phone: CONTACT.phoneDisplay,
      phoneHref: CONTACT.phoneHref,
      whatsappUrl: CONTACT.whatsappUrl,
      whatsapp: CONTACT.whatsappDisplay,
      address: CONTACT.address,
      hours: CONTACT.hours,
    },
  };
  return jsonOk(req, data);
}

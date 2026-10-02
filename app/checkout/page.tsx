import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  currencies,
  shippingRates,
  shippingZones,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-session";
import { getCart } from "@/lib/actions/cart";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { CONTACT, supportEmail } from "@/lib/contact";
import { getPaymentMethodsSafe } from "@/lib/payments";
import { paystackPublicKey } from "@/lib/paystack";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Checkout — Maison",
  description: "Checkout with live zone fees — cash on delivery or Paystack.",
};

export default async function CheckoutPage() {
  const sp = await requireUser("/checkout");

  const cartRes = await getCart();
  if (!cartRes.ok || cartRes.data.lines.length === 0) redirect("/cart");

  const [zoneRows, rateRows, curRows, methodRows] = await Promise.all([
    db.select().from(shippingZones).where(eq(shippingZones.active, true)),
    db.select().from(shippingRates),
    db.select().from(currencies).where(eq(currencies.active, true)),
    getPaymentMethodsSafe(),
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

  const boxedCurrencies = curRows.map((c) => ({
    code: c.code,
    symbol: c.symbol,
    label: c.label,
    rateToBase: c.rateToBase,
    isBase: c.isBase,
  }));

  if (zones.length === 0 || boxedCurrencies.length === 0) {
    return (
      <main className="editorial-grid py-14">
        <div className="col-span-12 max-w-xl">
          <p className="text-xs tracking-[0.3em] uppercase text-bronze">Checkout</p>
          <h1 className="font-display mt-2 text-4xl">Delivery is being prepared</h1>
          <p className="mt-4 leading-relaxed text-ink-soft">
            The shop hasn&apos;t configured delivery zones or currencies yet.
            Your selection is saved — please try again shortly.
          </p>
        </div>
      </main>
    );
  }

  const defaultCurrency =
    boxedCurrencies.find((c) => c.isBase) ?? boxedCurrencies[0]!;

  const liveMethods = methodRows.filter((m) => m.enabled);
  const headline =
    liveMethods.length === 1 && liveMethods[0]!.code === "paystack"
      ? "Pay now"
      : liveMethods.length === 1 && liveMethods[0]!.code === "cod"
        ? "Cash on delivery"
        : "Checkout";

  return (
    <main className="editorial-grid py-10 md:py-14">
      <div className="col-span-12">
        <p className="text-xs tracking-[0.3em] uppercase text-bronze">Checkout</p>
        <h1 className="font-display mt-2 text-4xl md:text-6xl">{headline}</h1>
        <p className="mt-3 max-w-prose text-ink-soft">
          Pay the rider on arrival — they call before delivery. Questions? Write to{" "}
          <a
            href={`mailto:${supportEmail()}`}
            className="text-bronze-deep underline underline-offset-4"
          >
            {supportEmail()}
          </a>{" "}
          ·{" "}
          <a href={CONTACT.phoneHref} className="text-bronze-deep underline underline-offset-4">
            {CONTACT.phoneDisplay}
          </a>{" "}
          ·{" "}
          <a
            href={CONTACT.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-bronze-deep underline underline-offset-4"
          >
            {CONTACT.whatsappDisplay}
          </a>{" "}
          ({CONTACT.hours}) ·{" "}
          <Link href="/contact" className="text-bronze-deep underline underline-offset-4">
            Contact the shop
          </Link>
          .
        </p>
      </div>
      <div className="col-span-12">
        <CheckoutForm
          email={sp.user.email}
          name={sp.user.name ?? ""}
          zones={zones}
          currencies={boxedCurrencies}
          defaultCurrencyCode={defaultCurrency.code}
          lines={cartRes.data.lines.map((l) => ({
            productId: l.productId,
            name: l.name,
            image: l.image,
            qty: l.qty,
            unitBaseCents: l.unitBaseCents,
            lineBaseCents: l.lineBaseCents,
          }))}
          subtotalBaseCents={cartRes.data.subtotalBaseCents}
          paymentMethods={methodRows}
          paystackPublicKey={paystackPublicKey()}
        />
      </div>
    </main>
  );
}

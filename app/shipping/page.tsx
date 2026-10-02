import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping — Maison",
  description: "Delivery zones, fees, ETAs and rider behavior for Maison cash-on-delivery orders.",
};

export default function ShippingPage() {
  return (
    <main className="editorial-grid py-10 md:py-14">
      <div className="col-span-12 lg:col-span-8 lg:col-start-3">
        <p className="text-xs tracking-[0.3em] uppercase text-bronze">Help</p>
        <h1 className="font-display mt-2 text-4xl md:text-6xl">Shipping</h1>
        <p className="mt-3 max-w-prose text-ink-soft">
          Cash on delivery. The fee for your zone shows at checkout before you
          place the order — it never changes after.
        </p>
        <div className="mt-8 flex flex-col gap-4">
          <section className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 className="font-display text-xl">Lagos — 1–2 days</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Orders under ₦50,000 pay a ₦2,500 delivery fee. Orders of ₦50,000
              and above deliver free. Fees and thresholds are set by the shop
              team and may change — checkout always shows the live fee.
            </p>
          </section>
          <section className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 className="font-display text-xl">Nationwide — 3–5 days</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Orders under ₦100,000 pay ₦5,500. Orders of ₦100,000 and above pay
              ₦3,500. Remote routes can take a day longer — the shop confirms
              every order before dispatch.
            </p>
          </section>
          <section className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 className="font-display text-xl">International — 7–14 days</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Flat ₦25,000 handling plus courier handoff. Duties at the
              destination are the buyer&apos;s responsibility.
            </p>
          </section>
          <section className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 className="font-display text-xl">Rider behavior</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-soft">
              <li>Rider calls 30–60 minutes before arrival — keep your phone nearby.</li>
              <li>Doorstep carry-in only; no assembly service.</li>
              <li>Pay exact cash or instant transfer on delivery — riders carry no change.</li>
            </ul>
          </section>
        </div>
        <p className="mt-6 text-sm text-ink-mute">
          Zone details pending verification. Questions?{" "}
          <Link href="/contact" className="text-bronze-deep underline underline-offset-4">
            Contact the shop
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

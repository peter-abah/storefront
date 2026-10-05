import Link from "next/link";
import type { Metadata } from "next";
import { CONTACT } from "@/lib/contact";
import { supportEmailAsync } from "@/lib/admin-emails";

export const metadata: Metadata = {
  title: "Terms — Maison",
  description: "Terms for cash-on-delivery orders from the Maison shop.",
};

export default async function TermsPage() {
  const email = await supportEmailAsync();
  return (
    <main className="editorial-grid py-10 md:py-14">
      <div className="col-span-12 lg:col-span-8 lg:col-start-3">
        <p className="text-xs tracking-[0.3em] uppercase text-bronze">Help</p>
        <h1 className="font-display mt-2 text-4xl md:text-6xl">Terms</h1>
        <p className="mt-3 max-w-prose text-ink-soft">
          {CONTACT.tradingName} ({CONTACT.cac} — shop details pending verification)
          sells home &amp; living pieces cash on delivery.
        </p>
        <div className="mt-8 flex flex-col gap-4 text-sm leading-relaxed text-ink-soft">
          <section className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 className="font-display text-xl text-ink">Orders + pricing</h2>
            <p className="mt-2">
              Prices are re-confirmed from the shop&apos;s records when you check
              out — the total shown at checkout is final and frozen on your
              order. Currency display may vary, but the priced base total never
              changes after checkout.
            </p>
          </section>
          <section className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 className="font-display text-xl text-ink">Payment</h2>
            <p className="mt-2">
              Cash on delivery only: exact cash or instant transfer to the rider
              on arrival. No online payment is taken in advance.
            </p>
          </section>
          <section className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 className="font-display text-xl text-ink">Cancellation</h2>
            <p className="mt-2">
              Cancel within 12 hours while the order is still pending, from your{" "}
              <Link href="/orders" className="text-bronze-deep underline underline-offset-4">
                orders page
              </Link>
              . After confirmation, write to{" "}
              <a href={`mailto:${email}`} className="text-bronze-deep underline underline-offset-4">
                {email}
              </a>{" "}
              — dispatch may already be arranged.
            </p>
          </section>
          <section className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 className="font-display text-xl text-ink">Delivery + returns</h2>
            <p className="mt-2">
              Delivery follows the{" "}
              <Link href="/shipping" className="text-bronze-deep underline underline-offset-4">
                shipping page
              </Link>{" "}
              and returns follow the{" "}
              <Link href="/returns" className="text-bronze-deep underline underline-offset-4">
                returns page
              </Link>
              . Photography on the site is illustrative of each collection.
            </p>
          </section>
        </div>
        <p className="mt-6 text-sm text-ink-mute">
          Terms pending verification. Questions? Write to{" "}
          <a href={`mailto:${email}`} className="text-bronze-deep underline underline-offset-4">
            {email}
          </a>
          {" "}·{" "}
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
    </main>
  );
}

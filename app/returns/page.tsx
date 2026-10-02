import Link from "next/link";
import type { Metadata } from "next";
import { CONTACT, supportEmail } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Returns — Maison",
  description: "Inspection window, defect remedy, return freight and refund timeline.",
};

export default function ReturnsPage() {
  const email = supportEmail();
  return (
    <main className="editorial-grid py-10 md:py-14">
      <div className="col-span-12 lg:col-span-8 lg:col-start-3">
        <p className="text-xs tracking-[0.3em] uppercase text-bronze">Help</p>
        <h1 className="font-display mt-2 text-4xl md:text-6xl">Returns</h1>
        <p className="mt-3 max-w-prose text-ink-soft">
          Inspect your pieces on delivery. Nothing was charged in advance — cash
          moves only at your door.
        </p>
        <div className="mt-8 flex flex-col gap-4">
          <section className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 className="font-display text-xl">Window + remedy</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              48-hour inspection on delivery plus a 7-day manufacturing-defect
              window. Remedy is replacement or refund — the shop confirms which
              after seeing photos.
            </p>
          </section>
          <section className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 className="font-display text-xl">Return freight</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Buyers cover return freight except for defect or damage in
              transit, which the shop covers.
            </p>
          </section>
          <section className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 className="font-display text-xl">Refund timeline</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Approved refunds go by bank transfer within 5–7 business days of
              the returned pieces arriving back.
            </p>
          </section>
          <section className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 className="font-display text-xl">How to request</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Write to{" "}
              <a href={`mailto:${email}`} className="text-bronze-deep underline underline-offset-4">
                {email}
              </a>{" "}
              with your order number and photos of the issue.
              To cancel an unconfirmed order instead, see{" "}
              <Link href="/faq" className="text-bronze-deep underline underline-offset-4">
                cancellation in the FAQ
              </Link>
              .
            </p>
          </section>
        </div>
        <p className="mt-6 text-sm text-ink-mute">
          Returns details pending verification. Questions? Write to{" "}
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

import type { Metadata } from "next";
import { CONTACT } from "@/lib/contact";
import { supportEmailAsync } from "@/lib/admin-emails";

export const metadata: Metadata = {
  title: "Contact — Maison",
  description: "Reach the Maison shop: address, phone, WhatsApp, email and hours.",
};

export default async function ContactPage() {
  const email = await supportEmailAsync();
  return (
    <main className="editorial-grid py-10 md:py-14">
      <div className="col-span-12 lg:col-span-8 lg:col-start-3">
        <p className="text-xs tracking-[0.3em] uppercase text-bronze">Help</p>
        <h1 className="font-display mt-2 text-4xl md:text-6xl">Contact</h1>
        <p className="mt-3 max-w-prose text-ink-soft">
          For orders, delivery and returns — include your order number so the shop
          can find you quickly.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <section className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 className="font-display text-xl">Visit / pickup</h2>
            <address className="mt-2 text-sm leading-relaxed text-ink-soft not-italic">
              {CONTACT.address}
              <br />
              <span className="text-ink-mute">{CONTACT.pickupNote}</span>
            </address>
          </section>
          <section className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 className="font-display text-xl">Call / WhatsApp</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              <a href={CONTACT.phoneHref} className="text-bronze-deep underline underline-offset-4">
                {CONTACT.phoneDisplay}
              </a>
              <br />
              <a
                href={CONTACT.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-bronze-deep underline underline-offset-4"
              >
                {CONTACT.whatsappDisplay}
              </a>
              <br />
              <span className="text-ink-mute">{CONTACT.hours}</span>
            </p>
          </section>
          <section className="rounded-lg border border-ink/10 bg-cream p-5 sm:col-span-2">
            <h2 className="font-display text-xl">Email</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              <a
                href={`mailto:${email}`}
                className="text-bronze-deep underline underline-offset-4"
              >
                {email}
              </a>
              <br />
              <span className="text-ink-mute">
                {CONTACT.tradingName} · {CONTACT.cac} — shop details pending verification.
              </span>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

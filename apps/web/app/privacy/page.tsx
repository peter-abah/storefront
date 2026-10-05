import Link from "next/link";
import type { Metadata } from "next";
import { CONTACT } from "@/lib/contact";
import { supportEmailAsync } from "@/lib/admin-emails";

export const metadata: Metadata = {
  title: "Privacy — Maison",
  description: "What Maison keeps, how long, and how to request deletion (NDPR).",
};

export default async function PrivacyPage() {
  const email = await supportEmailAsync();
  return (
    <main className="editorial-grid py-10 md:py-14">
      <div className="col-span-12 lg:col-span-8 lg:col-start-3">
        <p className="text-xs tracking-[0.3em] uppercase text-bronze">Help</p>
        <h1 className="font-display mt-2 text-4xl md:text-6xl">Privacy</h1>
        <p className="mt-3 max-w-prose text-ink-soft">
          Sign-in is by Google only. Checkout details are used to deliver your
          order — nothing else.
        </p>
        <div className="mt-8 flex flex-col gap-4 text-sm leading-relaxed text-ink-soft">
          <section className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 className="font-display text-xl text-ink">Data kept</h2>
            <p className="mt-2">
              Name, phone, email, delivery address and order history — needed
              for fulfillment, rider contact and support.
            </p>
          </section>
          <section className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 className="font-display text-xl text-ink">Retention</h2>
            <p className="mt-2">
              Order records are kept for 5 years for tax and dispute records.
              Marketing mail is never sent — order and delivery mail only.
            </p>
          </section>
          <section className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 className="font-display text-xl text-ink">Deletion path</h2>
            <p className="mt-2">
              Write to{" "}
              <a href={`mailto:${email}?subject=${encodeURIComponent("Delete my data")}`} className="text-bronze-deep underline underline-offset-4">
                {email}
              </a>{" "}
              with the subject “Delete my data”. Requests are
              answered within 30 days, except records the law requires the shop
              to keep.
            </p>
          </section>
        </div>
        <p className="mt-6 text-sm text-ink-mute">
          Privacy notice pending verification. Questions? Write to{" "}
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

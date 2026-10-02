import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ — Maison",
  description: "Cash on delivery, login, delivery, cancellation and returns — answered.",
};

const ITEMS = [
  {
    q: "Do I need an account to buy?",
    a: "Browse as a guest, but checkout needs Google sign-in so the order, timeline and rider contact stay attached to you.",
  },
  {
    q: "How do I pay?",
    a: "Cash on delivery only — exact cash or instant transfer to the rider on arrival. Nothing is charged online.",
  },
  {
    q: "How much is delivery and how long?",
    a: "Lagos 1–2 days (₦2,500 under ₦50,000, free above); Nationwide 3–5 days (₦5,500 under ₦100,000, ₦3,500 above); International 7–14 days flat ₦25,000. The live fee shows at checkout — see Shipping for detail.",
  },
  {
    q: "Will the rider call me?",
    a: "Yes — 30–60 minutes before arrival. Keep the checkout phone nearby.",
  },
  {
    q: "Can I cancel my order?",
    a: "Yes, within 12 hours while it is still pending, from your orders page. After confirmation, contact support.",
  },
  {
    q: "What if my piece arrives damaged?",
    a: "Do not pay for a visibly damaged piece you refuse — then write to support with your order number and photos within 48 hours. Defect remedy is replacement or refund.",
  },
  {
    q: "Do prices change after I order?",
    a: "No. Totals are frozen at checkout in your chosen currency — later rate changes never rewrite your order.",
  },
];

export default function FaqPage() {
  return (
    <main className="editorial-grid py-10 md:py-14">
      <div className="col-span-12 lg:col-span-8 lg:col-start-3">
        <p className="text-xs tracking-[0.3em] uppercase text-bronze">Help</p>
        <h1 className="font-display mt-2 text-4xl md:text-6xl">FAQ</h1>
        <div className="mt-8 flex flex-col gap-4">
          {ITEMS.map((item) => (
            <section key={item.q} className="rounded-lg border border-ink/10 bg-cream p-5">
              <h2 className="font-display text-xl">{item.q}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.a}</p>
            </section>
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-mute">
          Still stuck?{" "}
          <Link href="/contact" className="text-bronze-deep underline underline-offset-4">
            Contact the shop
          </Link>{" "}
          ·{" "}
          <Link href="/shipping" className="text-bronze-deep underline underline-offset-4">
            Shipping
          </Link>{" "}
          ·{" "}
          <Link href="/returns" className="text-bronze-deep underline underline-offset-4">
            Returns
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

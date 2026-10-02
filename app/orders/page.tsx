import Link from "next/link";
import { requireUser } from "@/lib/auth-session";
import { getMyOrders } from "@/lib/actions/orders";
import { formatDisplay, toDisplay } from "@/lib/queries/products";
import { StatusPill } from "@/components/orders/StatusPill";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Orders — Maison",
  description: "Track your Maison orders.",
};

export default async function OrdersPage() {
  await requireUser("/orders");
  const res = await getMyOrders();
  const orders = res.ok ? res.data : [];

  return (
    <main className="editorial-grid py-10 md:py-14">
      <div className="col-span-12 lg:col-span-8 lg:col-start-3">
        <p className="text-xs tracking-[0.3em] uppercase text-bronze">Account</p>
        <h1 className="font-display mt-2 text-4xl md:text-6xl">Your orders</h1>

        {orders.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-bronze/50 bg-cream px-6 py-14 text-center">
            <h2 className="font-display text-2xl">No orders yet.</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
              When you check out cash on delivery, your pieces and their
              delivery timeline will live here.
            </p>
            <Link
              href="/shop"
              className="rounded-pill mt-6 inline-block bg-ink px-6 py-2.5 text-sm text-cream"
            >
              Start with the catalog
            </Link>
          </div>
        ) : (
          <ul className="mt-8 flex flex-col gap-4">
            {orders.map((o) => {
              const total = formatDisplay(
                toDisplay(o.totalBaseCents, o.fxRateSnapshot),
                { code: o.currencyCode, symbol: o.currencySymbol },
              );
              return (
                <li key={o.id} className="rounded-lg border border-ink/10 bg-cream p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Link
                        href={`/orders/${o.id}`}
                        className="font-display text-xl hover:text-bronze-deep"
                      >
                        Order {o.number}
                      </Link>
                      <p className="mt-1 text-xs text-ink-mute">
                        {new Date(o.createdAt).toLocaleDateString("en", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}{" "}
                        · {o.itemCount} {o.itemCount === 1 ? "item" : "items"} · {o.currencyCode}
                      </p>
                    </div>
                    <StatusPill status={o.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
                    <p className="text-sm text-ink-soft">
                      Total due on delivery: <strong className="text-ink">{total}</strong>
                    </p>
                    <Link
                      href={`/orders/${o.id}`}
                      className="text-sm text-bronze-deep underline underline-offset-4"
                    >
                      Track →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

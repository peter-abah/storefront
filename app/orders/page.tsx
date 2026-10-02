import Link from "next/link";
import { requireUser } from "@/lib/auth-session";
import { getMyOrders } from "@/lib/actions/orders";
import { formatDisplay, toDisplay } from "@/lib/queries/products";
import { StatusPill } from "@/components/orders/StatusPill";
import { EmptyState } from "@/components/storefront/EmptyState";
import { Folio } from "@/components/storefront/Editorial";

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
        <Folio index="06" label="Account — Order ledger" />
        <h1 className="font-display mt-3 text-4xl tracking-tight md:text-6xl">Your orders</h1>

        {orders.length === 0 ? (
          <div className="mt-8 border-t-2 border-ink bg-cream">
            <EmptyState
              eyebrow="Empty ledger — N° 00"
              title="No orders yet."
              body="When you check out cash on delivery, your pieces and their delivery timeline will live here — shop confirmation first, the rider calls before arrival."
              primary={{ href: "/shop", label: "Start with the catalog" }}
              secondary={[{ href: "/shop?room=living", label: "Explore Living Room" }]}
            />
          </div>
        ) : (
          <ul className="mt-8 flex flex-col gap-4">
            {orders.map((o, i) => {
              const total = formatDisplay(
                toDisplay(o.totalBaseCents, o.fxRateSnapshot),
                { code: o.currencyCode, symbol: o.currencySymbol },
              );
              return (
                <li key={o.id} className="border-t-2 border-ink bg-cream p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] tracking-[0.2em] uppercase text-bronze">
                        N° {String(i + 1).padStart(2, "0")}
                      </p>
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

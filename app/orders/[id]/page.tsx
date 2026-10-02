import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-session";
import { getOrderDetail } from "@/lib/actions/orders";
import { isBuyerCancellable } from "@/lib/order-machine";
import { formatDisplay, toDisplay } from "@/lib/queries/products";
import { ORDER_TIMELINE, canTransition, type OrderStatus } from "@/lib/order-machine";
import { StatusPill } from "@/components/orders/StatusPill";
import { CancelOrderButton } from "@/components/orders/CancelOrderButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Order — Maison`, description: `Order ${id}` };
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const isNew = sp.new === "1" || (Array.isArray(sp.new) ? sp.new[0] === "1" : false);

  await requireUser(`/orders/${id}`);
  const res = await getOrderDetail(id);
  if (!res.ok) {
    if (res.code === "NOT_FOUND") notFound();
    if (res.code === "UNAUTHENTICATED") redirect(`/login?callbackURL=${encodeURIComponent(`/orders/${id}`)}`);
    notFound();
  }
  const { order, items, zoneName, currency } = res.data;

  const price = (baseCents: number) =>
    formatDisplay(toDisplay(baseCents, order.fxRateSnapshot), currency);

  const currentIdx =
    order.status === "cancelled"
      ? -1
      : ORDER_TIMELINE.findIndex((s) => s.status === order.status);
  const nextStep =
    order.status !== "cancelled" && order.status !== "paid_on_delivery"
      ? ORDER_TIMELINE.find(
          (s) =>
            ORDER_TIMELINE.findIndex((t) => t.status === s.status) > currentIdx &&
            canTransition(order.status as OrderStatus, s.status),
        )
      : undefined;

  const addr = order.address;

  return (
    <main className="editorial-grid py-10 md:py-14">
      <div className="col-span-12 lg:col-span-8 lg:col-start-3">
        {isNew ? (
          <div role="status" className="mb-6 rounded-lg border border-moss/40 bg-moss/10 p-5">
            <p className="text-xs tracking-[0.28em] uppercase text-moss">Order placed</p>
            <h2 className="font-display mt-1 text-2xl">Thank you — pay the rider on delivery.</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              A confirmation email is on its way to <strong className="text-ink">{order.email}</strong>.
              The rider will call <strong className="text-ink">{addr.phone}</strong> before arriving.
            </p>
          </div>
        ) : null}

        <nav aria-label="Breadcrumb" className="text-sm text-ink-mute">
          <Link href="/orders" className="hover:text-bronze-deep">Orders</Link>
          <span aria-hidden> · </span>
          <span className="text-ink">{order.number}</span>
        </nav>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-4xl md:text-5xl">Order {order.number}</h1>
          <StatusPill status={order.status} />
        </div>
        <p className="mt-2 text-sm text-ink-mute">
          Placed{" "}
          {new Date(order.createdAt).toLocaleDateString("en", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}{" "}
          · priced in {order.currencyCode} at checkout
        </p>

        {order.status === "cancelled" ? (
          <div role="status" className="mt-6 rounded-lg border border-ink/15 bg-cream p-5">
            <h2 className="font-display text-xl">This order was cancelled.</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Nothing was charged — cash on delivery means money only moves at
              your door. Your cart was kept where possible; start again from the catalog.
            </p>
            <Link
              href="/shop"
              className="rounded-pill mt-4 inline-block bg-ink px-5 py-2.5 text-sm text-cream"
            >
              Back to the catalog
            </Link>
          </div>
        ) : (
          <ol aria-label="Delivery timeline" className="mt-8 flex flex-col gap-0">
            {ORDER_TIMELINE.map((step, i) => {
              const done = i <= currentIdx;
              const current = i === currentIdx;
              return (
                <li key={step.status} className="flex gap-4">
                  <span className="flex flex-col items-center" aria-hidden>
                    <span
                      className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                        done ? "bg-moss text-cream" : "border border-ink/20 text-ink-mute"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    {i < ORDER_TIMELINE.length - 1 ? (
                      <span className={`w-px flex-1 ${done ? "bg-moss" : "bg-ink/15"}`} />
                    ) : null}
                  </span>
                  <span className="pb-6">
                    <span className={`block text-sm font-medium ${current ? "text-ink" : done ? "text-ink-soft" : "text-ink-mute"}`}>
                      {step.label}
                      {current ? " · current" : ""}
                    </span>
                    {current && step.status === "pending" ? (
                      <span className="mt-0.5 block text-xs text-ink-mute">
                        The shop team confirms every order before dispatch.
                      </span>
                    ) : null}
                    {current && step.status === "out_for_delivery" ? (
                      <span className="mt-0.5 block text-xs text-ink-mute">
                        Keep {addr.phone} nearby — the rider calls before arriving.
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {nextStep ? (
          <p className="mt-1 text-xs text-ink-mute">Next: {nextStep.label} — we&apos;ll update you here.</p>
        ) : null}

        {isBuyerCancellable(order.status, order.createdAt) ? (
          <section aria-labelledby="cancel-h" className="mt-6 rounded-lg border border-ink/10 bg-cream p-5">
            <h2 id="cancel-h" className="font-display text-xl">Changed your mind?</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Cancel free within 12 hours while the order is still pending —
              stock returns to the shelf and nothing is charged. After that,{" "}
              <Link href="/contact" className="text-bronze-deep underline underline-offset-4">
                contact support
              </Link>{" "}
              or see{" "}
              <Link href="/returns" className="text-bronze-deep underline underline-offset-4">
                Returns
              </Link>
              .
            </p>
            <div className="mt-4">
              <CancelOrderButton orderId={order.id} />
            </div>
          </section>
        ) : null}

        <section aria-labelledby="items-h" className="mt-6 rounded-lg border border-ink/10 bg-cream p-5">
          <h2 id="items-h" className="font-display text-xl">Items</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {items.map((l) => (
              <li key={l.productId} className="flex items-center gap-3">
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-linen">
                  {l.image ? (
                    <Image src={l.image} alt="" fill sizes="48px" className="object-cover" loading="lazy" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  {l.slug ? (
                    <Link href={`/product/${l.slug}`} className="block truncate text-sm hover:text-bronze-deep">
                      {l.name}
                    </Link>
                  ) : (
                    <span className="block truncate text-sm">{l.name}</span>
                  )}
                  <span className="block text-xs text-ink-mute">× {l.qty}</span>
                </span>
                <span className="text-sm font-medium">{price(l.unitBaseCents * l.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-ink/10 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd>{price(order.subtotalBaseCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Delivery{zoneName ? ` (${zoneName})` : ""}</dt>
              <dd>{price(order.shippingBaseCents)}</dd>
            </div>
            <div className="flex justify-between border-t border-ink/10 pt-2 text-base font-medium">
              <dt>Total due on delivery</dt>
              <dd className="font-display text-xl">{price(order.totalBaseCents)}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="addr-h" className="mt-4 rounded-lg border border-ink/10 bg-cream p-5">
          <h2 id="addr-h" className="font-display text-xl">Deliver to</h2>
          <address className="mt-3 text-sm leading-relaxed text-ink-soft not-italic">
            <strong className="text-ink">{addr.name}</strong>
            <br />
            {addr.street}, {addr.city}, {addr.state} {addr.postal}, {addr.country}
            <br />
            {addr.phone} · {order.email}
            {addr.notes ? (
              <>
                <br />
                <span className="text-ink-mute">Note: {addr.notes}</span>
              </>
            ) : null}
          </address>
        </section>
      </div>
    </main>
  );
}

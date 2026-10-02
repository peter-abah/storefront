"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getOrderDetail, type OrderDetailDTO } from "@/lib/actions/orders";
import { transitionOrder, type AdminOrderRow } from "@/lib/actions/admin";
import { canTransition, isPrepaid, ORDER_STATUSES, type OrderStatus } from "@/lib/order-machine";
import { StatusPill } from "@/components/orders/StatusPill";

type Props = {
  orders: AdminOrderRow[];
  total: number;
  page: number;
  perPage: number;
  status: string;
};

const FILTERS = ["all", ...ORDER_STATUSES];

export function OrdersBoard({ orders, total, page, perPage, status }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetailDTO | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<OrderStatus | null>(null);
  const cancelConfirmRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const drawerCloseRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const closeDetail = useCallback(() => setSelectedId(null), []);

  // Escape close + focus trap + initial focus + focus restore for the drawer.
  useEffect(() => {
    if (!selectedId) return;
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const t = window.setTimeout(() => drawerCloseRef.current?.focus(), 0);
    const focusables = () =>
      drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      ) ?? [];
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (pendingCancel) setPendingCancel(null);
        else closeDetail();
        return;
      }
      if (e.key !== "Tab" || !drawerRef.current) return;
      const els = [...focusables()].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (els.length === 0) return;
      const first = els[0]!;
      const last = els[els.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus?.();
      previouslyFocused.current = null;
    };
  }, [selectedId, closeDetail, pendingCancel]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let live = true;
    setDetailLoading(true);
    setDetailError(null);
    getOrderDetail(selectedId).then((res) => {
      if (!live) return;
      if (!res.ok) setDetailError(res.message);
      else setDetail(res.data);
      setDetailLoading(false);
    });
    return () => {
      live = false;
    };
  }, [selectedId]);

  function goto(nextStatus: string, nextPage: number) {
    const params = new URLSearchParams();
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    router.push(`/admin/orders${qs ? `?${qs}` : ""}`);
  }

  async function transition(to: OrderStatus) {
    if (!selectedId || !detail) return;
    setActing(true);
    setActionError(null);
    try {
      const res = await transitionOrder(selectedId, to);
      if (!res.ok) {
        setActionError(res.message);
        return;
      }
      setPendingCancel(null);
      const fresh = await getOrderDetail(selectedId);
      if (fresh.ok) setDetail(fresh.data);
      router.refresh();
    } finally {
      setActing(false);
    }
  }

  function requestTransition(to: OrderStatus) {
    // Destructive cancel+restock needs an explicit confirm with order context.
    if (to === "cancelled") {
      setActionError(null);
      setPendingCancel(to);
      window.setTimeout(() => cancelConfirmRef.current?.focus(), 0);
      return;
    }
    void transition(to);
  }

  const pages = Math.max(1, Math.ceil(total / perPage));

  if (orders.length === 0 && status === "all" && page === 1) {
    return (
      <div className="rounded-lg border border-dashed border-bronze/50 bg-cream px-6 py-14 text-center">
        <h2 className="font-display text-2xl">No orders yet.</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
          When a shopper checks out cash on delivery, the order lands here. Confirm it, send it out with the rider,
          then mark it delivered and paid.
        </p>
      </div>
    );
  }

  const currentStatus = detail?.order.status as OrderStatus | undefined;
  const detailMethod = (detail?.order as { paymentMethod?: string | null } | undefined)?.paymentMethod ?? "cod";
  const detailPayStatus = (detail?.order as { paymentStatus?: string | null } | undefined)?.paymentStatus ?? "unpaid";
  const detailRef = (detail?.order as { paystackRef?: string | null } | undefined)?.paystackRef ?? null;
  const detailAuth = (detail?.order as { paystackAuth?: { last4?: string; brand?: string; channel?: string } | null } | undefined)?.paystackAuth ?? null;
  const prepaidPaid =
    isPrepaid(detailMethod) &&
    (detailPayStatus === "paid" ||
      ["paid_online", "confirmed", "out_for_delivery", "delivered"].includes(currentStatus ?? ""));
  const nextOptions: OrderStatus[] = currentStatus
    ? (ORDER_STATUSES as readonly OrderStatus[]).filter((s) => canTransition(currentStatus, s, detailMethod))
    : [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => goto(f, 1)}
            aria-pressed={status === f || (f === "all" && (status === "" || status === "all"))}
            className={`rounded-pill px-4 py-1.5 text-sm transition-transform duration-200 hover:-translate-y-0.5 ${
              (status === f || (f === "all" && (status === "" || status === "all")))
                ? "bg-ink text-cream"
                : "border border-ink/15 text-ink-soft"
            }`}
          >
            {f === "all" ? "All" : f.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-ink/20 bg-cream px-6 py-12 text-center">
          <h2 className="font-display text-xl">Nothing with this status.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            No {status.replace(/_/g, " ")} orders on this page. Try another status filter — new checkouts always start as
            pending.
          </p>
          <button
            type="button"
            onClick={() => goto("all", 1)}
            className="rounded-pill mt-4 border border-ink/15 px-4 py-1.5 text-sm"
          >
            Show all orders
          </button>
        </div>
      ) : (
        <>
          {/* Mobile card-list fallback under sm; table kept for sm+ with overflow-x-auto. */}
          <ul className="mt-6 flex flex-col gap-3 sm:hidden">
            {orders.map((o) => (
              <li key={o.id} className="rounded-lg border border-ink/10 bg-cream p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedId(o.id)}
                    aria-haspopup="dialog"
                    aria-expanded={selectedId === o.id}
                    aria-controls="order-detail-drawer"
                    className="font-medium hover:text-bronze-deep"
                  >
                    {o.number}
                  </button>
                  <StatusPill status={o.status} />
                </div>
                <p className="mt-1 truncate text-xs text-ink-mute">{o.email} · {o.currencyCode} · {((o as { paymentMethod?: string | null }).paymentMethod ?? "cod") === "paystack" ? "online" : "COD"}</p>
                <p className="mt-2 text-sm text-ink-soft">
                  {o.itemCount} {o.itemCount === 1 ? "item" : "items"} · {(o.totalBaseCents / 100).toLocaleString("en")} · {new Date(o.createdAt).toLocaleDateString("en")}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-6 hidden overflow-x-auto rounded-lg border border-ink/10 bg-cream sm:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink-mute">
                  <th scope="col" className="px-4 py-3">Order</th>
                  <th scope="col" className="px-4 py-3">Buyer</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Items</th>
                  <th scope="col" className="px-4 py-3">Total · base</th>
                  <th scope="col" className="px-4 py-3">Placed</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-ink/5 last:border-0">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedId(o.id)}
                        aria-haspopup="dialog"
                        aria-expanded={selectedId === o.id}
                        aria-controls="order-detail-drawer"
                        className="font-medium hover:text-bronze-deep"
                      >
                        {o.number}
                      </button>
                      <span className="block text-xs text-ink-mute">{o.currencyCode} · {((o as { paymentMethod?: string | null }).paymentMethod ?? "cod") === "paystack" ? "online" : "COD"}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{o.email}</td>
                    <td className="px-4 py-3"><StatusPill status={o.status} /></td>
                    <td className="px-4 py-3">{o.itemCount}</td>
                    <td className="px-4 py-3">{(o.totalBaseCents / 100).toLocaleString("en")}</td>
                    <td className="px-4 py-3 text-ink-mute">{new Date(o.createdAt).toLocaleDateString("en")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
        <p>Page {page} of {pages} · {total} orders</p>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => goto(status, page - 1)} className="rounded-pill border border-ink/15 px-4 py-1.5 disabled:opacity-50">← Prev</button>
          <button type="button" disabled={page >= pages} onClick={() => goto(status, page + 1)} className="rounded-pill border border-ink/15 px-4 py-1.5 disabled:opacity-50">Next →</button>
        </div>
      </div>

      {selectedId ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Order detail">
          <div aria-hidden onClick={closeDetail} className="absolute inset-0 bg-ink/40 transition-opacity duration-200" />
          <aside
            ref={drawerRef}
            id="order-detail-drawer"
            aria-label="Order detail panel"
            className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-paper p-5 shadow-lift transition-transform duration-200"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl">Order detail</h2>
              <button ref={drawerCloseRef} type="button" onClick={closeDetail} className="rounded-pill border border-ink/15 px-3 py-1 text-sm">Close</button>
            </div>
            {detailLoading ? (
              <p className="mt-6 text-sm text-ink-soft">Loading order…</p>
            ) : detailError ? (
              <p role="alert" className="mt-6 rounded-md bg-clay/10 p-3 text-sm text-clay">{detailError}</p>
            ) : detail ? (
              <div className="mt-4 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{detail.order.number}</p>
                  <StatusPill status={detail.order.status} />
                </div>
                <p className="text-xs text-ink-mute">
                  {isPrepaid(detailMethod) ? (
                    <>Paid online{detailRef ? <> · ref {detailRef}</> : null}{detailAuth?.last4 ? <> · {detailAuth.brand ?? "Card"} •• {detailAuth.last4}</> : null}{detailAuth?.channel ? <> · {detailAuth.channel}</> : null}</>
                  ) : (
                    <>Cash on delivery</>
                  )}
                </p>
                <section className="rounded-lg border border-ink/10 bg-cream p-4">
                  <h3 className="text-xs uppercase tracking-wide text-ink-mute">Items</h3>
                  <ul className="mt-2 flex flex-col gap-2 text-sm">
                    {detail.items.map((l) => (
                      <li key={l.productId} className="flex justify-between gap-3">
                        <span>{l.name} × {l.qty}</span>
                        <span>{((l.unitBaseCents * l.qty) / 100).toLocaleString("en")}</span>
                      </li>
                    ))}
                  </ul>
                  <dl className="mt-3 space-y-1 border-t border-ink/10 pt-3 text-sm">
                    <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd>{(detail.order.subtotalBaseCents / 100).toLocaleString("en")}</dd></div>
                    <div className="flex justify-between"><dt className="text-ink-soft">Delivery{detail.zoneName ? ` (${detail.zoneName})` : ""}</dt><dd>{(detail.order.shippingBaseCents / 100).toLocaleString("en")}</dd></div>
                    <div className="flex justify-between font-medium"><dt>Total</dt><dd>{(detail.order.totalBaseCents / 100).toLocaleString("en")} {detail.order.currencyCode}</dd></div>
                  </dl>
                </section>
                <section className="rounded-lg border border-ink/10 bg-cream p-4 text-sm leading-relaxed text-ink-soft">
                  <h3 className="text-xs uppercase tracking-wide text-ink-mute">Deliver to</h3>
                  <p className="mt-2">
                    <strong className="text-ink">{detail.order.address.name}</strong><br />
                    {detail.order.address.street}, {detail.order.address.city}, {detail.order.address.state} {detail.order.address.postal}, {detail.order.address.country}<br />
                    {detail.order.address.phone} · {detail.order.email}
                  </p>
                </section>
                <section className="rounded-lg border border-ink/10 bg-cream p-4">
                  <h3 className="text-xs uppercase tracking-wide text-ink-mute">Move this order</h3>
                  {nextOptions.length === 0 ? (
                    <p className="mt-2 text-sm text-ink-soft">Complete — this order remains as history.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {nextOptions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={acting}
                          onClick={() => requestTransition(s)}
                          className="rounded-pill bg-ink px-4 py-1.5 text-sm text-cream transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-50"
                        >
                          {s === "cancelled"
                            ? prepaidPaid
                              ? "Cancel + refund"
                              : "Cancel + restock"
                            : s.replace(/_/g, " ")}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs leading-relaxed text-ink-mute">
                    {prepaidPaid
                      ? "Cancelling a paid online order restocks every item and refunds via Paystack — the order stays as refunded."
                      : "Cancelling returns every item to stock and keeps the order as history."}
                    Confirm and out-for-delivery just flip the status.
                  </p>
                  {actionError ? <p role="alert" className="mt-2 text-sm text-clay">{actionError}</p> : null}
                </section>
              </div>
            ) : null}
            {pendingCancel === "cancelled" && detail ? (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <div
                  aria-hidden
                  onClick={() => setPendingCancel(null)}
                  className="absolute inset-0 bg-ink/40"
                />
                <div
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="cancel-restock-h"
                  aria-describedby="cancel-restock-d"
                  className="relative w-full max-w-md rounded-lg border border-ink/10 bg-paper p-5 shadow-lift"
                >
                  <h2 id="cancel-restock-h" className="font-display text-xl">
                    {prepaidPaid ? `Refund ${detail.order.number}?` : `Cancel ${detail.order.number}?`}
                  </h2>
                  <div id="cancel-restock-d" className="mt-2 text-sm leading-relaxed text-ink-soft">
                    <p>
                      {detail.items.length} {detail.items.length === 1 ? "line" : "lines"} ·{" "}
                      {detail.items.reduce((n, l) => n + l.qty, 0)} units will return to stock.
                      {prepaidPaid
                        ? " The Paystack payment is refunded automatically and the order stays in history as refunded."
                        : " The order stays in history as cancelled."}
                    </p>
                    <ul className="mt-2 flex max-h-32 flex-col gap-1 overflow-y-auto text-xs">
                      {detail.items.map((l) => (
                        <li key={l.productId} className="flex justify-between gap-2">
                          <span className="truncate">{l.name}</span>
                          <span>× {l.qty}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-ink-mute">
                      Restock note: every line goes back to the shelf; missing products are skipped and logged.
                    </p>
                  </div>
                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setPendingCancel(null)}
                      disabled={acting}
                      className="rounded-pill border border-ink/20 px-5 py-2 text-sm disabled:opacity-50"
                    >
                      Keep order
                    </button>
                    <button
                      type="button"
                      ref={cancelConfirmRef}
                      onClick={() => transition("cancelled")}
                      disabled={acting}
                      className="rounded-pill bg-clay px-5 py-2 text-sm text-cream disabled:opacity-50"
                    >
                      {acting ? "Cancelling…" : prepaidPaid ? "Yes, cancel + refund" : "Yes, cancel + restock"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

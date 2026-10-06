// Display vocabulary for order statuses — mirrors apps/web/lib/order-machine.ts
// (statuses, timeline forks, 12h buyer-cancel window) without importing the
// web app. Read-only labels; the server remains the source of truth for
// transitions and cancellability.

export type OrderStatusTone =
  | "progress"
  | "done"
  | "attention"
  | "neutral";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  awaiting_payment: "Awaiting payment",
  paid_online: "Paid online",
  confirmed: "Confirmed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  paid_on_delivery: "Paid on delivery",
  failed: "Payment failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const STATUS_TONES: Record<string, OrderStatusTone> = {
  pending: "progress",
  awaiting_payment: "progress",
  paid_online: "done",
  confirmed: "progress",
  out_for_delivery: "progress",
  delivered: "done",
  paid_on_delivery: "done",
  failed: "attention",
  cancelled: "neutral",
  refunded: "neutral",
};

export function orderStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function orderStatusTone(status: string): OrderStatusTone {
  return STATUS_TONES[status] ?? "neutral";
}

export type OrderTimelineStep = { status: string; label: string };

/** Linear COD timeline (order-machine.ts ORDER_TIMELINE). */
export const ORDER_TIMELINE_COD: OrderTimelineStep[] = [
  { status: "pending", label: "Placed" },
  { status: "confirmed", label: "Confirmed" },
  { status: "out_for_delivery", label: "Out for delivery" },
  { status: "delivered", label: "Delivered" },
  { status: "paid_on_delivery", label: "Paid on delivery" },
];

/** Prepaid fork: pay first, then the same fulfillment rail. */
export const ORDER_TIMELINE_ONLINE: OrderTimelineStep[] = [
  { status: "awaiting_payment", label: "Awaiting payment" },
  { status: "paid_online", label: "Paid online" },
  { status: "confirmed", label: "Confirmed" },
  { status: "out_for_delivery", label: "Out for delivery" },
  { status: "delivered", label: "Delivered" },
];

export function timelineFor(
  paymentMethod?: string | null,
): OrderTimelineStep[] {
  return paymentMethod === "paystack"
    ? ORDER_TIMELINE_ONLINE
    : ORDER_TIMELINE_COD;
}

/** Terminals the timeline cannot represent as a reached step. */
export const OFF_TIMELINE_STATUSES = ["failed", "cancelled", "refunded"];

export const BUYER_CANCEL_WINDOW_MS = 12 * 60 * 60 * 1000;

const BUYER_CANCELLABLE = ["pending", "awaiting_payment", "failed"];

/**
 * Client mirror of isBuyerCancellable + the cancelOrder guards — used only to
 * decide whether to offer the button. The server re-checks and its error is
 * surfaced faithfully when it disagrees.
 */
export function canRequestCancel(order: {
  status: string;
  paymentStatus: string;
  createdAt: string;
}): boolean {
  if (order.paymentStatus === "paid" || order.status === "paid_online") {
    return false;
  }
  if (!BUYER_CANCELLABLE.includes(order.status)) return false;
  const created = new Date(order.createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created <= BUYER_CANCEL_WINDOW_MS;
}

/** Reader-friendly local date/time for order rows and the detail header. */
export function formatOrderDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return date.toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return date.toISOString();
  }
}

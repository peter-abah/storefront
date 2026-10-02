// Order lifecycle: COD rail (pending → … → paid_on_delivery) + Paystack
// prepaid rail (awaiting_payment → paid_online → confirmed → … → delivered).
// Prepaid orders NEVER touch paid_on_delivery — delivery of a paid order is
// terminal at delivered. failed/refunded are prepaid-only leaves.
// Display-only in shop UI; admin enforces transitions server-side via
// canTransition (pass paymentMethod so the prepaid guard holds).
export const ORDER_STATUSES = [
  "pending",
  "awaiting_payment",
  "paid_online",
  "confirmed",
  "out_for_delivery",
  "delivered",
  "paid_on_delivery",
  "failed",
  "cancelled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const NEXT: Record<
  Exclude<OrderStatus, "paid_on_delivery" | "cancelled" | "refunded">,
  OrderStatus[]
> = {
  pending: ["confirmed", "cancelled"],
  awaiting_payment: ["paid_online", "cancelled", "failed"],
  paid_online: ["confirmed", "cancelled", "refunded"],
  failed: ["awaiting_payment", "cancelled"],
  confirmed: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: ["paid_on_delivery"],
};

/** Prepaid (Paystack) orders never collect cash — block paid_on_delivery. */
export function isPrepaid(paymentMethod?: string | null): boolean {
  return paymentMethod === "paystack";
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  paymentMethod?: string | null,
): boolean {
  if (from === "paid_on_delivery" || from === "cancelled" || from === "refunded") {
    return false;
  }
  if (to === "paid_on_delivery" && isPrepaid(paymentMethod)) return false;
  return NEXT[from].includes(to);
}

/** Linear COD timeline for the shopper detail page. */
export const ORDER_TIMELINE: { status: OrderStatus; label: string }[] = [
  { status: "pending", label: "Placed" },
  { status: "confirmed", label: "Confirmed" },
  { status: "out_for_delivery", label: "Out for delivery" },
  { status: "delivered", label: "Delivered" },
  { status: "paid_on_delivery", label: "Paid on delivery" },
];

/** Prepaid fork: pay first, then the same fulfillment rail. */
export const ORDER_TIMELINE_ONLINE: { status: OrderStatus; label: string }[] = [
  { status: "awaiting_payment", label: "Awaiting payment" },
  { status: "paid_online", label: "Paid online" },
  { status: "confirmed", label: "Confirmed" },
  { status: "out_for_delivery", label: "Out for delivery" },
  { status: "delivered", label: "Delivered" },
];

/** Pick the timeline fork by payment method (defaults to the COD rail). */
export function timelineFor(
  paymentMethod?: string | null,
): { status: OrderStatus; label: string }[] {
  return isPrepaid(paymentMethod) ? ORDER_TIMELINE_ONLINE : ORDER_TIMELINE;
}

/** Buyer-cancel window (DRAFT per docs/BUSINESS_FACTS.md): 12h while the
 *  order holds no captured money — pending (COD) or awaiting/failed
 *  (prepaid, nothing decremented yet). Paid orders go through the shop. */
export const BUYER_CANCEL_WINDOW_MS = 12 * 60 * 60 * 1000;

const BUYER_CANCELLABLE = ["pending", "awaiting_payment", "failed"] as const;

export function isBuyerCancellable(status: string, createdAt: Date): boolean {
  if (!(BUYER_CANCELLABLE as readonly string[]).includes(status)) return false;
  return Date.now() - new Date(createdAt).getTime() <= BUYER_CANCEL_WINDOW_MS;
}

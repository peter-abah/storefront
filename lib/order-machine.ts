// COD order lifecycle (PRD F7 / ADR-008). Display-only in V1 shop UI —
// no status transitions ship in storefront actions; admin enforces these
// server-side in a later wave via this same machine.
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "out_for_delivery",
  "delivered",
  "paid_on_delivery",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const NEXT: Record<Exclude<OrderStatus, "paid_on_delivery" | "cancelled">, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: ["paid_on_delivery"],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === "paid_on_delivery" || from === "cancelled") return false;
  return NEXT[from].includes(to);
}

/** Linear timeline steps for the shopper detail page. */
export const ORDER_TIMELINE: { status: OrderStatus; label: string }[] = [
  { status: "pending", label: "Placed" },
  { status: "confirmed", label: "Confirmed" },
  { status: "out_for_delivery", label: "Out for delivery" },
  { status: "delivered", label: "Delivered" },
  { status: "paid_on_delivery", label: "Paid on delivery" },
];

/** Buyer-cancel window (DRAFT per docs/BUSINESS_FACTS.md): 12h while pending. */
export const BUYER_CANCEL_WINDOW_MS = 12 * 60 * 60 * 1000;

export function isBuyerCancellable(status: string, createdAt: Date): boolean {
  if (status !== "pending") return false;
  return Date.now() - new Date(createdAt).getTime() <= BUYER_CANCEL_WINDOW_MS;
}

export function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    pending: "bg-clay/15 text-clay",
    awaiting_payment: "bg-clay/15 text-clay",
    paid_online: "bg-moss/15 text-moss",
    confirmed: "bg-bronze/15 text-bronze-deep",
    out_for_delivery: "bg-bronze/15 text-bronze-deep",
    delivered: "bg-moss/15 text-moss",
    paid_on_delivery: "bg-moss/20 text-moss",
    failed: "bg-clay/20 text-clay",
    cancelled: "bg-ink/10 text-ink-mute",
    refunded: "bg-ink/10 text-ink-mute",
  };
  const label: Record<string, string> = {
    pending: "Placed",
    awaiting_payment: "Awaiting payment",
    paid_online: "Paid online",
    confirmed: "Confirmed",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    paid_on_delivery: "Delivered · paid",
    failed: "Payment failed",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };
  return (
    <span
      className={`rounded-pill inline-block px-3 py-1 text-xs ${cls[status] ?? "bg-ink/10 text-ink-mute"}`}
    >
      {label[status] ?? status}
    </span>
  );
}

import type { AdminStats } from "@/lib/actions/admin";

type Props = {
  stats: AdminStats;
  baseSymbol?: string;
};

function formatBaseCents(cents: number, symbol: string): string {
  const major = cents / 100;
  try {
    return `${symbol}${major.toLocaleString("en")}`;
  } catch {
    return `${symbol}${major}`;
  }
}

export function KpiStrip({ stats, baseSymbol = "" }: Props) {
  const cards = [
    {
      label: "Awaiting confirmation",
      value: String(stats.pendingCount),
      hint: "Pending orders need a Confirm or Cancel.",
    },
    {
      label: "Out for delivery",
      value: String(stats.outForDeliveryCount),
      hint: "Riders are carrying these now.",
    },
    {
      label: "Low stock (≤ 5)",
      value: String(stats.lowStockCount),
      hint: "Active products running thin.",
    },
    {
      label: "Cash collected",
      value: formatBaseCents(stats.codCollectedCents, baseSymbol),
      hint: "COD delivered and paid, in base currency.",
    },
    {
      label: "Online collected",
      value: formatBaseCents(stats.onlineCollectedCents, baseSymbol),
      hint: "Paystack orders past payment, in base currency.",
    },
    {
      label: "Failed emails",
      value: String(stats.failedEmailCount),
      hint: "Resend from the Emails tab.",
    },
  ];
  return (
    <section aria-label="Shop overview" className="grid grid-cols-2 gap-4 lg:grid-cols-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-ink/10 bg-cream p-4 transition-transform duration-200 hover:-translate-y-0.5"
        >
          <p className="text-xs tracking-wide uppercase text-ink-mute">{c.label}</p>
          <p className="font-display mt-1 text-3xl">{c.value}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">{c.hint}</p>
        </div>
      ))}
    </section>
  );
}

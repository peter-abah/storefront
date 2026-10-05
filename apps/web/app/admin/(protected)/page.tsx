import Link from "next/link";
import { getAdminStats, listCurrencies } from "@/lib/actions/admin";
import { KpiStrip } from "@/components/admin/KpiStrip";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin overview — Maison",
  description: "Pending orders, low stock, COD collected and failed emails.",
};

export default async function AdminOverviewPage() {
  const [statsRes, curRes] = await Promise.all([getAdminStats(), listCurrencies()]);
  if (!statsRes.ok) {
    return (
      <main className="editorial-grid py-10">
        <div className="col-span-12">
          <p role="alert" className="rounded-md bg-clay/10 p-4 text-sm text-clay">{statsRes.message}</p>
        </div>
      </main>
    );
  }
  const base = curRes.ok ? curRes.data.find((c) => c.isBase) ?? curRes.data[0] : undefined;

  return (
    <main className="editorial-grid py-10">
      <div className="col-span-12">
        <p className="text-xs tracking-[0.3em] uppercase text-bronze">Overview</p>
        <h2 className="font-display mt-2 text-4xl">What needs you today</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">
          Confirm pending orders first, top up anything with five or fewer units, and clear failed emails before the
          next dispatch window.
        </p>
      </div>
      <div className="col-span-12 mt-6">
        <KpiStrip stats={statsRes.data} baseSymbol={base?.symbol ?? ""} />
      </div>
      <div className="col-span-12 mt-8 flex flex-wrap gap-2">
        <Link href="/admin/orders?status=pending" className="rounded-pill bg-ink px-5 py-2 text-sm text-cream transition-transform duration-200 hover:-translate-y-0.5">
          Confirm pending orders
        </Link>
        <Link href="/admin/products" className="rounded-pill border border-ink/15 px-5 py-2 text-sm transition-transform duration-200 hover:-translate-y-0.5">
          Restock products
        </Link>
        <Link href="/admin/emails" className="rounded-pill border border-ink/15 px-5 py-2 text-sm transition-transform duration-200 hover:-translate-y-0.5">
          Review failed emails
        </Link>
      </div>
    </main>
  );
}

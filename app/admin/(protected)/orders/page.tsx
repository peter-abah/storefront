import { listOrdersAdmin } from "@/lib/actions/admin";
import { OrdersBoard } from "@/components/admin/OrdersBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin orders — Maison",
  description: "Confirm, dispatch, deliver and cancel COD orders.",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const statusRaw = typeof sp.status === "string" ? sp.status : Array.isArray(sp.status) ? sp.status[0] ?? "all" : "all";
  const status = statusRaw || "all";
  const pageRaw = typeof sp.page === "string" ? sp.page : Array.isArray(sp.page) ? sp.page[0] : "1";
  const page = Math.max(1, Number(pageRaw) || 1);
  // Email deep-link (?order=<uuid> from confirmUrl/adminUrl). UUID-shaped
  // only — full validation happens in getOrderDetailAdmin; anything else
  // is ignored so the list still renders.
  const orderRaw = typeof sp.order === "string" ? sp.order : Array.isArray(sp.order) ? sp.order[0] : undefined;
  const initialSelectedId =
    orderRaw && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderRaw)
      ? orderRaw
      : null;

  const res = await listOrdersAdmin({ status, page });
  if (!res.ok) {
    return (
      <main className="editorial-grid py-10">
        <div className="col-span-12">
          <p role="alert" className="rounded-md bg-clay/10 p-4 text-sm text-clay">{res.message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="editorial-grid py-10">
      <div className="col-span-12">
        <p className="text-xs tracking-[0.3em] uppercase text-bronze">Fulfillment</p>
        <h2 className="font-display mt-2 text-4xl">Orders · {res.data.total}</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">
          New checkouts arrive as pending. Open an order to confirm it, send it out with the rider, then mark it
          delivered and paid when cash lands.
        </p>
      </div>
      <div className="col-span-12 mt-6">
        <OrdersBoard
          orders={res.data.items}
          total={res.data.total}
          page={res.data.page}
          perPage={res.data.perPage}
          status={status}
          initialSelectedId={initialSelectedId}
        />
      </div>
    </main>
  );
}

import { emailLogList } from "@/lib/actions/admin";
import { EmailLogTable } from "@/components/admin/EmailLogTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin emails — Maison",
  description: "Order email log with per-row resend.",
};

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const orderRaw = typeof sp.order === "string" ? sp.order : Array.isArray(sp.order) ? sp.order[0] ?? "" : "";
  const pageRaw = typeof sp.page === "string" ? sp.page : Array.isArray(sp.page) ? sp.page[0] : "1";
  const page = Math.max(1, Number(pageRaw) || 1);

  const res = await emailLogList({ orderNumber: orderRaw, page });
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
        <p className="text-xs tracking-[0.3em] uppercase text-bronze">Support</p>
        <h2 className="font-display mt-2 text-4xl">Email log · {res.data.total}</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">
          Each order sends three emails: buyer, shop, and admin copy. Resend any failed send here.
        </p>
      </div>
      <div className="col-span-12 mt-6">
        <EmailLogTable
          logs={res.data.items}
          total={res.data.total}
          page={res.data.page}
          perPage={res.data.perPage}
          orderNumber={orderRaw}
        />
      </div>
    </main>
  );
}

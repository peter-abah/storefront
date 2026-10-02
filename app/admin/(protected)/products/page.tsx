import Link from "next/link";
import { listProductsAdmin } from "@/lib/actions/admin";
import { ProductForm, ProductRowActions } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin products — Maison",
  description: "Create, edit, hide and restock products.",
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const search = typeof sp.search === "string" ? sp.search : Array.isArray(sp.search) ? sp.search[0] ?? "" : "";
  const pageRaw = typeof sp.page === "string" ? sp.page : Array.isArray(sp.page) ? sp.page[0] : "1";
  const page = Math.max(1, Number(pageRaw) || 1);

  const res = await listProductsAdmin({ search, page });
  if (!res.ok) {
    return (
      <main className="editorial-grid py-10">
        <div className="col-span-12">
          <p role="alert" className="rounded-md bg-clay/10 p-4 text-sm text-clay">{res.message}</p>
        </div>
      </main>
    );
  }
  const { items, total, perPage } = res.data;
  const pages = Math.max(1, Math.ceil(total / perPage));

  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return `/admin/products${s ? `?${s}` : ""}`;
  };

  return (
    <main className="editorial-grid py-10">
      <div className="col-span-12 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.3em] uppercase text-bronze">Catalog</p>
          <h2 className="font-display mt-2 text-4xl">Products · {total}</h2>
        </div>
        <ProductForm />
      </div>

      <div className="col-span-12 mt-6">
        <form method="get" action="/admin/products" className="flex max-w-md flex-col gap-2 sm:flex-row" role="search" aria-label="Search products">
          <input
            name="search"
            defaultValue={search}
            placeholder="Search by name…"
            className="w-full rounded-md border border-ink/20 bg-cream px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-pill shrink-0 bg-ink px-5 py-2 text-sm text-cream">
            Search
          </button>
        </form>
      </div>

      <div className="col-span-12 mt-6">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-bronze/50 bg-cream px-6 py-14 text-center">
            <h3 className="font-display text-2xl">{search ? `Nothing matches “${search}”.` : "No products yet."}</h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
              {search
                ? "Try a shorter word from the name — or create it from scratch with New product."
                : "Create your first piece with New product — name, price, and one image URL per line."}
            </p>
            <div className="mt-4 flex justify-center">
              <ProductForm />
            </div>
          </div>
        ) : (
          <>
            {/* Mobile card-list fallback under sm; table kept for sm+ with overflow-x-auto. */}
            <ul className="flex flex-col gap-3 sm:hidden">
              {items.map((p) => (
                <li key={p.id} className="rounded-lg border border-ink/10 bg-cream p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="truncate text-xs text-ink-mute">{p.slug} · {p.room} · {p.category}</p>
                    </div>
                    <ProductForm product={p} />
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">
                    {(p.priceBaseCents / 100).toLocaleString("en")} base
                  </p>
                  <div className="mt-2">
                    <ProductRowActions product={p} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-lg border border-ink/10 bg-cream sm:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink-mute">
                    <th scope="col" className="px-4 py-3">Product</th>
                    <th scope="col" className="px-4 py-3">Price (base)</th>
                    <th scope="col" className="px-4 py-3">Stock · Active</th>
                    <th scope="col" className="px-4 py-3">Room · Category</th>
                    <th scope="col" className="px-4 py-3">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id} className="border-b border-ink/5 last:border-0">
                      <td className="px-4 py-3">
                        <span className="block font-medium">{p.name}</span>
                        <span className="block text-xs text-ink-mute">{p.slug}</span>
                      </td>
                      <td className="px-4 py-3">{(p.priceBaseCents / 100).toLocaleString("en")}</td>
                      <td className="px-4 py-3">
                        <ProductRowActions product={p} />
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{p.room} · {p.category}</td>
                      <td className="px-4 py-3">
                        <ProductForm product={p} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="col-span-12 mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
        <p>Page {page} of {pages} · {total} products</p>
        <nav aria-label="Products pages" className="flex gap-2">
          {page <= 1 ? (
            <button type="button" disabled aria-disabled="true" tabIndex={-1} className="rounded-pill border border-ink/15 px-4 py-1.5 opacity-50">← Prev</button>
          ) : (
            <Link href={qs(page - 1)} className="rounded-pill border border-ink/15 px-4 py-1.5">← Prev</Link>
          )}
          {page >= pages ? (
            <button type="button" disabled aria-disabled="true" tabIndex={-1} className="rounded-pill border border-ink/15 px-4 py-1.5 opacity-50">Next →</button>
          ) : (
            <Link href={qs(page + 1)} className="rounded-pill border border-ink/15 px-4 py-1.5">Next →</Link>
          )}
        </nav>
      </div>
    </main>
  );
}

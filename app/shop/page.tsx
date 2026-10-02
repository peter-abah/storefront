import {
  formatDisplay,
  getDisplayCurrency,
  getFilterMeta,
  listProducts,
  toDisplay,
  type ProductSort,
} from "@/lib/queries/products";
import { SearchFilters } from "@/components/storefront/SearchFilters";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Pagination } from "@/components/storefront/Pagination";
import { Reveal } from "@/components/storefront/Reveal";
import { CatalogInterlude, Folio } from "@/components/storefront/Editorial";
import { EmptyState } from "@/components/storefront/EmptyState";

export const revalidate = 60;

export const metadata = {
  title: "Shop — Maison",
  description: "Search and filter 150+ home & living pieces by room, category, price and availability.",
};

const PER_PAGE = 24;
const SORTS: ProductSort[] = ["featured", "newest", "price_asc", "price_desc"];

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function toMajorCents(v: string): number | undefined {
  if (v.trim() === "") return undefined; // absent/blank input = no bound (Number("") is 0, not NaN)
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n * 100);
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const search = first(sp.search).trim();
  const room = first(sp.room).trim();
  const category = first(sp.category).trim();
  const sortRaw = first(sp.sort).trim();
  const sort: ProductSort = SORTS.includes(sortRaw as ProductSort)
    ? (sortRaw as ProductSort)
    : "featured";
  const page = Math.max(1, Math.floor(Number(first(sp.page)) || 1));
  const inStock = ["1", "true", "yes"].includes(first(sp.inStock).toLowerCase());
  const currencyCode = first(sp.currency).trim() || undefined;
  const minPrice = toMajorCents(first(sp.minPrice).trim());
  const maxPrice = toMajorCents(first(sp.maxPrice).trim());

  const [{ items, total }, meta, currency] = await Promise.all([
    listProducts({
      search: search || undefined,
      room: room || undefined,
      category: category || undefined,
      minPrice,
      maxPrice,
      inStock: inStock || undefined,
      sort,
      page,
      perPage: PER_PAGE,
    }),
    getFilterMeta(),
    getDisplayCurrency(currencyCode),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const priceOf = (baseCents: number) => formatDisplay(toDisplay(baseCents, currency.rateToBase), currency);
  const hasFilters =
    search !== "" || room !== "" || category !== "" || inStock || minPrice != null || maxPrice != null;

  const pageParams: Record<string, string | undefined> = {
    ...(search ? { search } : {}),
    ...(room ? { room } : {}),
    ...(category ? { category } : {}),
    ...(first(sp.minPrice) ? { minPrice: first(sp.minPrice) } : {}),
    ...(first(sp.maxPrice) ? { maxPrice: first(sp.maxPrice) } : {}),
    ...(inStock ? { inStock: "1" } : {}),
    ...(sort !== "featured" ? { sort } : {}),
    ...(currencyCode ? { currency: currencyCode } : {}),
  };

  return (
    <main className="editorial-grid items-start py-10 md:py-14">
      <div className="col-span-12">
        <Folio index="03" label={`Index — Catalog · ${total} ${total === 1 ? "piece" : "pieces"}`} />
        <h1 className="font-display mt-3 text-4xl tracking-tight md:text-6xl">Shop all pieces</h1>
        <p className="mt-3 max-w-prose text-ink-soft">
          {total} {total === 1 ? "piece" : "pieces"}
          {room ? (
            <>
              {" "}in <strong className="text-ink">{room}</strong>
            </>
          ) : null}
          {search ? (
            <>
              {" "}for <strong className="text-ink">“{search}”</strong>
            </>
          ) : null}{" "}
          · priced in {currency.symbol} ({currency.code})
        </p>
      </div>

      <aside className="col-span-12 md:col-span-3 lg:col-span-3">
        <div className="border-t-2 border-ink bg-cream p-5 md:sticky md:top-24">
          <h2 className="font-display mb-1 text-xl">Filters</h2>
          <p className="mb-4 text-xs tracking-[0.18em] uppercase text-ink-mute">Refine the index</p>
          <SearchFilters
            initial={{
              search,
              room,
              category,
              minPrice: first(sp.minPrice),
              maxPrice: first(sp.maxPrice),
              inStock,
              sort,
            }}
            rooms={meta.rooms}
            categories={meta.categories}
          />
        </div>
      </aside>

      <section aria-label="Products" className="col-span-12 md:col-span-9">
        {items.length === 0 ? (
          <div className="border-t-2 border-ink bg-cream">
            <EmptyState
              eyebrow={search ? `No matches for “${search}”` : "No matches"}
              title={search ? `Nothing matches “${search}” with these filters.` : "Nothing matches these filters."}
              body="Try widening the price range, clearing “in stock only”, or start from a room — most rattan and oak pieces live under Living Room and Bedroom."
              primary={{ href: "/shop", label: "Clear all filters" }}
              secondary={meta.rooms.slice(0, 3).map((r) => ({
                href: `/shop?room=${encodeURIComponent(r)}`,
                label: `Explore ${r}`,
              }))}
            />
            {hasFilters ? null : (
              <p className="border-t border-ink/10 py-3 text-center text-xs text-ink-mute">
                Our shelves are being restocked — please return shortly.
              </p>
            )}
          </div>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {items.flatMap((p, i) => {
                const card = (
                  <li key={p.id}>
                    <Reveal delay={Math.min((i % 6) * 0.05, 0.25)}>
                      <ProductCard product={p} priceLabel={priceOf(p.priceBaseCents)} index={i} />
                    </Reveal>
                  </li>
                );
                // Editorial break after the sixth entry — rhythm over card soup.
                if (i === 5 && items.length > 8) {
                  return [
                    card,
                    <li key="interlude" className="sm:col-span-2 lg:col-span-3">
                      <CatalogInterlude
                        index="04"
                        line="Built to age gracefully in real homes — solid timber, honest textiles."
                        sub="Every piece lists materials, dimensions and care. Cash on delivery."
                      />
                    </li>,
                  ];
                }
                return [card];
              })}
            </ul>
            <p className="mt-8 border-t border-ink/10 pt-3 text-xs tracking-[0.18em] uppercase text-ink-mute">
              End of page {Math.min(page, totalPages)} of {totalPages} — {total} pieces indexed
            </p>
            <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} params={pageParams} />
          </>
        )}
      </section>
    </main>
  );
}

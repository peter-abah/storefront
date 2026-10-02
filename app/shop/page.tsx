import Link from "next/link";
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
        <p className="text-xs tracking-[0.3em] uppercase text-bronze">Catalog</p>
        <h1 className="font-display mt-2 text-4xl md:text-6xl">Shop all pieces</h1>
        <p className="mt-3 max-w-prose text-ink-soft">
          {total} {total === 1 ? "piece" : "pieces"}
          {search ? (
            <>
              {" "}for <strong className="text-ink">“{search}”</strong>
            </>
          ) : null}{" "}
          · priced in {currency.symbol} ({currency.code})
        </p>
      </div>

      <aside className="col-span-12 md:col-span-3 lg:col-span-3">
        <div className="rounded-lg border border-ink/10 bg-cream p-5 md:sticky md:top-6">
          <h2 className="font-display mb-4 text-xl">Filters</h2>
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
          <div className="rounded-lg border border-dashed border-bronze/50 bg-cream px-6 py-14 text-center">
            <p className="text-xs tracking-[0.28em] uppercase text-bronze">No matches</p>
            <h2 className="font-display mx-auto mt-3 max-w-md text-2xl md:text-3xl">
              {search ? (
                <>Nothing matches “{search}” with these filters.</>
              ) : (
                <>Nothing matches these filters.</>
              )}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
              Try widening the price range, clearing “in stock only”, or start from a room —
              most rattan and oak pieces live under Living Room and Bedroom.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link
                href="/shop"
                className="rounded-pill bg-ink px-5 py-2.5 text-sm text-cream"
              >
                Clear all filters
              </Link>
              {meta.rooms.slice(0, 4).map((r) => (
                <Link
                  key={r}
                  href={`/shop?room=${encodeURIComponent(r)}`}
                  className="rounded-pill border border-ink/15 px-5 py-2.5 text-sm hover:border-bronze"
                >
                  Explore {r}
                </Link>
              ))}
            </div>
            {hasFilters ? null : (
              <p className="mt-4 text-xs text-ink-mute">
                Our collection is being prepared — please return shortly.
              </p>
            )}
          </div>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p, i) => (
                <li key={p.id}>
                  <Reveal delay={Math.min((i % 6) * 0.05, 0.25)}>
                    <ProductCard product={p} priceLabel={priceOf(p.priceBaseCents)} />
                  </Reveal>
                </li>
              ))}
            </ul>
            <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} params={pageParams} />
          </>
        )}
      </section>
    </main>
  );
}

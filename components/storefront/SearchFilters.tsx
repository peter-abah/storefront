"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type FilterInitial = {
  search: string;
  room: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
  sort: string;
};

type SearchFiltersProps = {
  initial: FilterInitial;
  rooms: string[];
  categories: string[];
};

function buildQuery(next: FilterInitial): string {
  const qs = new URLSearchParams();
  if (next.search.trim()) qs.set("search", next.search.trim());
  if (next.room) qs.set("room", next.room);
  if (next.category) qs.set("category", next.category);
  if (next.minPrice) qs.set("minPrice", next.minPrice);
  if (next.maxPrice) qs.set("maxPrice", next.maxPrice);
  if (next.inStock) qs.set("inStock", "1");
  if (next.sort && next.sort !== "featured") qs.set("sort", next.sort);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

const SORTS = [
  ["featured", "Featured"],
  ["newest", "Newest"],
  ["price_asc", "Price: low to high"],
  ["price_desc", "Price: high to low"],
] as const;

export function SearchFilters({ initial, rooms, categories }: SearchFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState<FilterInitial>(initial);

  // Keep local draft in sync when the URL changes (back/forward, clear-all).
  useEffect(() => {
    setDraft(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initial)]);

  // Debounced push for the free-text search; selects push immediately.
  useEffect(() => {
    if (draft.search === initial.search) return;
    const t = setTimeout(() => {
      router.replace(`${pathname}${buildQuery(draft)}`, { scroll: false });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.search]);

  function push(next: FilterInitial) {
    setDraft(next);
    router.replace(`${pathname}${buildQuery(next)}`, { scroll: false });
  }

  const inputCls =
    "w-full min-w-0 rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm outline-offset-2 placeholder:text-ink-mute focus:border-bronze";
  const labelCls = "mb-1 block text-xs tracking-[0.18em] uppercase text-ink-mute";

  return (
    <form
      role="search"
      aria-label="Filter products"
      action="/shop"
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        router.replace(`${pathname}${buildQuery(draft)}`, { scroll: false });
      }}
      className="space-y-5"
    >
      <div>
        <label htmlFor="f-search" className={labelCls}>
          Search
        </label>
        <input
          id="f-search"
          name="search"
          type="search"
          placeholder="rattan, oak, brass…"
          autoComplete="off"
          value={draft.search}
          onChange={(e) => setDraft({ ...draft, search: e.target.value })}
          className={inputCls}
        />
        <p className="mt-1 text-xs text-ink-mute">Name, story or material.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label htmlFor="f-room" className={labelCls}>
            Room
          </label>
          <select
            id="f-room"
            name="room"
            value={draft.room}
            onChange={(e) => push({ ...draft, room: e.target.value })}
            className={inputCls}
          >
            <option value="">All rooms</option>
            {rooms.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="f-category" className={labelCls}>
            Category
          </label>
          <select
            id="f-category"
            name="category"
            value={draft.category}
            onChange={(e) => push({ ...draft, category: e.target.value })}
            className={inputCls}
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className={labelCls}>Price</span>
        <div className="grid grid-cols-2 gap-3">
          <input
            name="minPrice"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Min"
            aria-label="Minimum price"
            value={draft.minPrice}
            onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })}
            onBlur={() => push(draft)}
            className={inputCls}
          />
          <input
            name="maxPrice"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Max"
            aria-label="Maximum price"
            value={draft.maxPrice}
            onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })}
            onBlur={() => push(draft)}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label htmlFor="f-sort" className={labelCls}>
          Sort
        </label>
        <select
          id="f-sort"
          name="sort"
          value={draft.sort}
          onChange={(e) => push({ ...draft, sort: e.target.value })}
          className={inputCls}
        >
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="inStock"
          checked={draft.inStock}
          onChange={(e) => push({ ...draft, inStock: e.target.checked })}
          className="h-4 w-4 accent-bronze"
        />
        In stock only
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-pill bg-ink px-4 py-2 text-sm text-cream"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => router.replace(pathname, { scroll: false })}
          className="rounded-pill border border-ink/15 px-4 py-2 text-sm hover:border-bronze"
        >
          Clear
        </button>
      </div>
    </form>
  );
}

import Link from "next/link";

type PaginationProps = {
  page: number;
  totalPages: number;
  params: Record<string, string | undefined>;
};

function hrefFor(page: number, params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") qs.set(k, v);
  }
  if (page > 1) qs.set("page", String(page));
  const s = qs.toString();
  return s ? `/shop?${s}` : "/shop";
}

export function Pagination({ page, totalPages, params }: PaginationProps) {
  if (totalPages <= 1) return null;
  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);
  // Compact window: current ± 2, clamped.
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  const numbers: number[] = [];
  for (let p = start; p <= end; p++) numbers.push(p);

  const btn =
    "rounded-pill border px-4 py-2 text-sm transition-colors hover:border-bronze";
  return (
    <nav aria-label="Catalog pages" className="mt-10 flex flex-wrap items-center gap-2">
      {page <= 1 ? (
        <button type="button" disabled aria-disabled="true" tabIndex={-1} className={`${btn} opacity-40`}>
          ← Prev
        </button>
      ) : (
        <Link href={hrefFor(prev, params)} className={`${btn} border-ink/15`}>
          ← Prev
        </Link>
      )}
      {numbers.map((p) => (
        <Link
          key={p}
          href={hrefFor(p, params)}
          aria-current={p === page ? "page" : undefined}
          className={`${btn} ${p === page ? "border-bronze bg-bronze text-cream" : "border-ink/15"}`}
        >
          {p}
        </Link>
      ))}
      {page >= totalPages ? (
        <button type="button" disabled aria-disabled="true" tabIndex={-1} className={`${btn} opacity-40`}>
          Next →
        </button>
      ) : (
        <Link href={hrefFor(next, params)} className={`${btn} border-ink/15`}>
          Next →
        </Link>
      )}
      <span className="ml-2 text-sm text-ink-mute">
        Page {page} of {totalPages}
      </span>
    </nav>
  );
}

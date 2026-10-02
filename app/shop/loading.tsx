export default function ShopLoading() {
  return (
    <main className="editorial-grid items-start py-10 md:py-14" aria-busy="true" aria-label="Loading catalog">
      <div className="col-span-12">
        <div className="h-4 w-24 animate-pulse rounded bg-ink/10" />
        <div className="mt-3 h-10 w-64 animate-pulse rounded bg-ink/10" />
      </div>
      <div className="col-span-12 md:col-span-3">
        <div className="h-96 animate-pulse rounded-lg bg-cream" />
      </div>
      <div className="col-span-12 md:col-span-9">
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="overflow-hidden rounded-lg border border-ink/10 bg-cream">
              <div className="aspect-[4/3] animate-pulse bg-linen" />
              <div className="space-y-2 p-4">
                <div className="h-3 w-24 animate-pulse rounded bg-ink/10" />
                <div className="h-5 w-full animate-pulse rounded bg-ink/10" />
                <div className="h-4 w-20 animate-pulse rounded bg-ink/10" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

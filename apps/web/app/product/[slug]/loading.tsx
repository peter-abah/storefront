export default function ProductLoading() {
  return (
    <main className="editorial-grid py-10 md:py-14" aria-busy="true" aria-label="Loading product">
      <div className="col-span-12 h-4 w-48 animate-pulse rounded bg-ink/10" />
      <div className="col-span-12 lg:col-span-7">
        <div className="aspect-[4/3] animate-pulse rounded-lg bg-linen" />
      </div>
      <div className="col-span-12 lg:col-span-5">
        <div className="h-4 w-32 animate-pulse rounded bg-ink/10" />
        <div className="mt-3 h-10 w-full animate-pulse rounded bg-ink/10" />
        <div className="mt-3 h-6 w-2/3 animate-pulse rounded bg-ink/10" />
        <div className="mt-5 h-8 w-40 animate-pulse rounded bg-ink/10" />
        <div className="mt-6 h-48 animate-pulse rounded-lg bg-cream" />
      </div>
    </main>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="editorial-grid py-20">
      <div className="col-span-12 text-center md:col-span-8 md:col-start-3">
        <p className="text-xs tracking-[0.3em] uppercase text-bronze">Off the shelf</p>
        <h1 className="font-display mt-4 text-4xl md:text-6xl">That piece isn&apos;t here.</h1>
        <p className="mx-auto mt-4 max-w-prose text-ink-soft">
          It may have sold through or the link is off — begin with Living Room.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Link href="/shop" className="rounded-pill bg-ink px-6 py-3 text-sm text-cream">
            Browse the catalog
          </Link>
          <Link
            href="/shop?room=living"
            className="rounded-pill border border-bronze/40 px-6 py-3 text-sm text-bronze-deep"
          >
            Explore Living Room
          </Link>
        </div>
      </div>
    </main>
  );
}

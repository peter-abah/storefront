"use client";

export default function ShopError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="editorial-grid py-16">
      <div className="col-span-12 rounded-lg border border-ink/10 bg-cream p-8 text-center md:col-span-8 md:col-start-3">
        <p className="text-xs tracking-[0.28em] uppercase text-bronze">Catalog hiccup</p>
        <h1 className="font-display mt-3 text-3xl">The shelf didn&apos;t load.</h1>
        <p className="mx-auto mt-3 max-w-prose text-sm text-ink-soft">
          Our shelves are waking — please wait a moment and try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-pill mt-6 bg-ink px-5 py-2.5 text-sm text-cream"
        >
          Try again
        </button>
      </div>
    </main>
  );
}

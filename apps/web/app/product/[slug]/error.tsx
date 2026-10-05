"use client";

export default function ProductError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="editorial-grid py-16">
      <div className="col-span-12 rounded-lg border border-ink/10 bg-cream p-8 text-center md:col-span-8 md:col-start-3">
        <p className="text-xs tracking-[0.28em] uppercase text-bronze">Story interrupted</p>
        <h1 className="font-display mt-3 text-3xl">This product didn&apos;t load.</h1>
        <p className="mx-auto mt-3 max-w-prose text-sm text-ink-soft">
          This piece is briefly unavailable — try again or return to the collection.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-pill bg-ink px-5 py-2.5 text-sm text-cream"
          >
            Try again
          </button>
          <a
            href="/shop"
            className="rounded-pill border border-ink/15 px-5 py-2.5 text-sm"
          >
            Back to shop
          </a>
        </div>
      </div>
    </main>
  );
}

import type { Product } from "@/lib/queries/products";
import { Folio } from "./Editorial";

type ProductSpecsProps = {
  product: Product;
};

/**
 * Phase 3 specs — a narrative ledger, not a data table.
 * Ruled definition rows with chapter folio; same fields, story feel.
 */
export function ProductSpecs({ product }: ProductSpecsProps) {
  const dims = product.dimensions;
  const dimLabel = dims ? `${dims.w} × ${dims.d} × ${dims.h} ${dims.unit}` : "—";
  const rows: [string, string][] = [
    ["Materials", (product.materials ?? []).join(", ") || "—"],
    ["Dimensions (W × D × H)", dimLabel],
    ["Weight", product.weightKg != null ? `${product.weightKg} kg` : "—"],
    ["Care", product.care || "—"],
    ["Room / Category", `${product.room} / ${product.category}`],
  ];
  return (
    <section aria-label="Specifications">
      <Folio index="03" label="Chapter III — Specifications" />
      <dl className="mt-4 border-t border-ink/10">
        {rows.map(([k, v], i) => (
          <div
            key={k}
            className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-ink/10 py-3 sm:grid-cols-[2.5rem_11rem_1fr]"
          >
            <dt className="sr-only">{k}</dt>
            <span aria-hidden className="text-[11px] tracking-[0.2em] text-bronze">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-xs tracking-[0.14em] uppercase text-ink-mute">{k}</span>
            <span className="col-span-2 text-sm leading-relaxed text-ink sm:col-span-1">
              {v}
            </span>
          </div>
        ))}
      </dl>
      <p className="font-display mt-3 text-sm text-ink-soft italic">
        Every figure above is measured from the batch that ships — if it
        doesn&rsquo;t fit your doorway, write to the shop before ordering.
      </p>
    </section>
  );
}

import type { Product } from "@/lib/queries/products";

type ProductSpecsProps = {
  product: Product;
};

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
    <section aria-label="Specifications" className="overflow-hidden rounded-lg border border-ink/10">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-ink/10 last:border-0 odd:bg-cream even:bg-paper">
              <th scope="row" className="w-44 px-4 py-3 text-left font-medium text-ink-mute">
                {k}
              </th>
              <td className="px-4 py-3">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

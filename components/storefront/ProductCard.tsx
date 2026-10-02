import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/queries/products";
import { AddToCart } from "@/components/cart/AddToCart";

type ProductCardProps = {
  product: Product;
  priceLabel: string;
  /** 0-based position in its grid — drives the anti-monotony rhythm. */
  index?: number;
};

/**
 * Phase 3 ProductCard — same data + AddToCart logic, editorial rhythm.
 * Alternating image ratio (4/3 vs 4/5), alternating paper/cream ground,
 * folio number and story line so grids read as an index, not card soup.
 */
export function ProductCard({ product, priceLabel, index = 0 }: ProductCardProps) {
  const first = product.images[0];
  const out = product.stock <= 0;
  const tall = index % 3 === 1;
  const folio = String(index + 1).padStart(2, "0");

  return (
    <article className="group flex flex-col">
      <Link
        href={`/product/${product.slug}`}
        className="block overflow-hidden"
        aria-label={product.name}
        tabIndex={-1}
      >
        <div
          className={`relative overflow-hidden rounded-lg bg-linen ring-1 ring-ink/10 ${
            tall ? "aspect-[4/5]" : "aspect-[4/3]"
          }`}
        >
          {first ? (
            <Image
              src={first.url}
              alt={`${product.name} — image 1`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-700 ease-expo group-hover:scale-[1.05]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink-mute">
              Photography to come
            </div>
          )}
          {out ? (
            <span className="absolute top-3 left-3 rounded-pill bg-ink px-3 py-1 text-xs text-cream">
              Out of stock
            </span>
          ) : product.featured ? (
            <span className="absolute top-3 left-3 rounded-pill bg-bronze px-3 py-1 text-xs text-cream">
              Featured
            </span>
          ) : null}
          <span className="absolute right-3 bottom-2 text-[11px] tracking-[0.2em] uppercase text-cream/90">
            N° {folio}
          </span>
        </div>
      </Link>
      <div className={`mt-3 flex flex-1 flex-col border-t border-ink/10 pt-3 ${tall ? "md:pl-1" : ""}`}>
        <p className="flex items-baseline justify-between gap-2 text-[11px] tracking-[0.2em] uppercase text-ink-mute">
          <span>
            {product.room} · {product.category}
          </span>
          <span className="text-bronze">§ {folio}</span>
        </p>
        <h3 className="font-display mt-1 line-clamp-2 text-lg leading-snug">
          <Link href={`/product/${product.slug}`} className="hover:text-bronze-deep">
            {product.name}
          </Link>
        </h3>
        {product.tagline ? (
          <p className="mt-1 line-clamp-1 text-sm text-ink-soft italic">{product.tagline}</p>
        ) : null}
        <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            <p className="text-[15px] font-medium">{priceLabel}</p>
            <p className={`mt-0.5 text-xs ${out ? "text-clay" : "text-moss"}`}>
              {out ? "Out of stock" : product.stock <= 5 ? `Only ${product.stock} left` : "In stock"}
            </p>
          </div>
          <AddToCart productId={product.id} stock={product.stock} mode="compact" />
        </div>
      </div>
    </article>
  );
}

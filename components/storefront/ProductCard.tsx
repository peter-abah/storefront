import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/queries/products";
import { AddToCart } from "@/components/cart/AddToCart";

type ProductCardProps = {
  product: Product;
  priceLabel: string;
};

export function ProductCard({ product, priceLabel }: ProductCardProps) {
  const first = product.images[0];
  const out = product.stock <= 0;
  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-ink/10 bg-cream">
      <Link
        href={`/product/${product.slug}`}
        className="block overflow-hidden"
        aria-label={product.name}
        tabIndex={-1}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-linen">
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
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] tracking-[0.2em] uppercase text-ink-mute">
          {product.room} · {product.category}
        </p>
        <h3 className="font-display mt-1 line-clamp-2 text-lg leading-snug">
          <Link href={`/product/${product.slug}`} className="hover:text-bronze-deep">
            {product.name}
          </Link>
        </h3>
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

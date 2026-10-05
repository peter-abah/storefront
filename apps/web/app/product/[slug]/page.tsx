import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatDisplay,
  getDisplayCurrency,
  getProduct,
  getRelated,
  toDisplay,
} from "@/lib/queries/products";
import { ProductGallery } from "@/components/storefront/ProductGallery";
import { ProductSpecs } from "@/components/storefront/ProductSpecs";
import { ProductCard } from "@/components/storefront/ProductCard";
import { AddToCart } from "@/components/cart/AddToCart";
import { Reveal } from "@/components/storefront/Reveal";

export const revalidate = 60;

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product || !product.active) return { title: "Not found — Maison" };
  return {
    title: `${product.name} — Maison`,
    description: product.tagline ?? product.story?.slice(0, 160),
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const rawCurrency = sp.currency;
  const currencyCode = (Array.isArray(rawCurrency) ? rawCurrency[0] : rawCurrency)?.trim() || undefined;

  const product = await getProduct(slug);
  if (!product || !product.active) notFound();

  const [related, currency] = await Promise.all([
    getRelated(product, 4),
    getDisplayCurrency(currencyCode),
  ]);

  const priceLabel = formatDisplay(toDisplay(product.priceBaseCents, currency.rateToBase), currency);
  const out = product.stock <= 0;
  const low = !out && product.stock <= 5;
  const displayMajor = toDisplay(product.priceBaseCents, currency.rateToBase) / 100;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.story ?? product.tagline ?? undefined,
    sku: product.slug,
    category: `${product.room} / ${product.category}`,
    image: product.images.map((i) => i.url),
    offers: {
      "@type": "Offer",
      priceCurrency: currency.code,
      price: displayMajor.toFixed(2),
      availability: out ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
  };

  return (
    <main className="editorial-grid py-10 md:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className="col-span-12 flex flex-wrap items-center gap-2 text-sm text-ink-mute">
        <span className="text-[11px] tracking-[0.28em] uppercase text-bronze">Folio —</span>
        <Link href="/" className="hover:text-bronze-deep">Home</Link>
        <span aria-hidden> · </span>
        <Link href="/shop" className="hover:text-bronze-deep">Shop</Link>
        <span aria-hidden> · </span>
        <Link href={`/shop?room=${encodeURIComponent(product.room)}`} className="hover:text-bronze-deep">
          {product.room}
        </Link>
        <span aria-hidden> · </span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="col-span-12 lg:col-span-7">
        <ProductGallery images={product.images} name={product.name} />
        {product.story ? (
          <div className="mt-8 max-w-prose lg:hidden">
            <p className="text-[11px] tracking-[0.28em] uppercase text-bronze">Chapter II — Story</p>
            <p className="story-dropcap mt-3 leading-relaxed text-ink-soft">{product.story}</p>
          </div>
        ) : null}
      </div>

      <div className="col-span-12 lg:col-span-5">
        <p className="text-xs tracking-[0.28em] uppercase text-bronze">
          Chapter I — {product.room} · {product.category}
        </p>
        <h1 className="font-display mt-3 text-4xl leading-tight tracking-tight md:text-5xl">{product.name}</h1>
        {product.tagline ? (
          <blockquote className="mt-4 border-l-2 border-bronze pl-4 text-lg text-ink-soft italic">
            {product.tagline}
          </blockquote>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <p className="font-display text-3xl" aria-label={`Price ${priceLabel}`}>
            {priceLabel}
          </p>
          <span
            className={`rounded-pill px-3 py-1 text-xs ${
              out ? "bg-ink text-cream" : low ? "bg-clay/15 text-clay" : "bg-moss/15 text-moss"
            }`}
          >
            {out ? "Out of stock" : low ? `Only ${product.stock} left` : "In stock"}
          </span>
        </div>
        <p className="mt-2 text-xs text-ink-mute">
          Shown in {currency.symbol} ({currency.code}) · priced at today&rsquo;s rate — frozen on your order.
        </p>

        {!out ? (
          <div className="mt-5">
            <AddToCart productId={product.id} stock={product.stock} mode="full" />
          </div>
        ) : null}

        {product.story ? (
          <div className="mt-6 hidden max-w-prose lg:block">
            <p className="text-[11px] tracking-[0.28em] uppercase text-bronze">Chapter II — Story</p>
            <p className="story-dropcap mt-3 leading-relaxed text-ink-soft">{product.story}</p>
          </div>
        ) : null}

        <div className="mt-8 border-t border-ink/10 pt-6">
          <ProductSpecs product={product} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/shop"
            className="rounded-pill border border-ink/20 px-5 py-2.5 text-sm hover:border-bronze"
          >
            ← Back to catalog
          </Link>
          <Link
            href={`/shop?room=${encodeURIComponent(product.room)}`}
            className="rounded-pill border border-bronze/40 px-5 py-2.5 text-sm text-bronze-deep"
          >
            More {product.room} pieces
          </Link>
        </div>
        {out ? (
          <p className="mt-4 rounded-md bg-cream p-4 text-sm leading-relaxed text-ink-soft">
            This piece is out of stock right now. Browse the {product.room} room for similar{" "}
            {product.category} — new batches land regularly.
          </p>
        ) : null}
      </div>

      {related.length > 0 ? (
        <section aria-label="Related products" className="col-span-12 mt-6 border-t border-ink/10 pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] tracking-[0.28em] uppercase text-bronze">Chapter IV — Keep reading</p>
              <h2 className="font-display mt-2 text-2xl tracking-tight md:text-4xl">Pairs well with</h2>
            </div>
            <Link
              href={`/shop?room=${encodeURIComponent(product.room)}`}
              className="text-sm text-bronze-deep underline underline-offset-4"
            >
              More {product.room} →
            </Link>
          </div>
          <ul className="mt-6 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r, i) => (
              <li key={r.id}>
                <Reveal delay={Math.min(i * 0.06, 0.25)}>
                  <ProductCard
                    product={r}
                    index={i}
                    priceLabel={formatDisplay(toDisplay(r.priceBaseCents, currency.rateToBase), currency)}
                  />
                </Reveal>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

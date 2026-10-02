import Link from "next/link";
import {
  formatDisplay,
  getDisplayCurrency,
  listProducts,
  getFilterMeta,
  toDisplay,
} from "@/lib/queries/products";
import { Hero } from "@/components/storefront/Hero";
import { RoomRail } from "@/components/storefront/RoomRail";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Reveal } from "@/components/storefront/Reveal";

export const revalidate = 60;

export const metadata = {
  title: "Maison — Home & Living",
  description:
    "Small-batch furniture, lighting and textiles. Browse by room, read every story, check out with cash on delivery.",
};

export default async function Home() {
  const [{ items, total }, meta, currency] = await Promise.all([
    listProducts({ sort: "featured", page: 1, perPage: 8 }),
    getFilterMeta(),
    getDisplayCurrency(),
  ]);

  const rate = currency.rateToBase;
  const priceOf = (baseCents: number) => formatDisplay(toDisplay(baseCents, rate), currency);
  const featuredShown = items.filter((p) => p.featured).length || items.length;

  return (
    <main className="min-h-screen">
      <Hero productCount={total} featuredCount={featuredShown} />
      <RoomRail rooms={meta.rooms} />

      <section aria-label="Featured products" className="editorial-grid py-12 md:py-16">
        <div className="col-span-12 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.3em] uppercase text-bronze">Editors&rsquo; picks</p>
            <h2 className="font-display mt-2 text-3xl md:text-5xl">Featured stories</h2>
          </div>
          <Link href="/shop?sort=featured" className="text-sm text-bronze-deep underline underline-offset-4">
            View all {total} pieces →
          </Link>
        </div>
        <div className="col-span-12 mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((p, i) => (
            <Reveal key={p.id} delay={Math.min(i * 0.06, 0.3)}>
              <ProductCard product={p} priceLabel={priceOf(p.priceBaseCents)} />
            </Reveal>
          ))}
        </div>
      </section>

      <section aria-label="Craftsmanship manifesto" className="border-t border-ink/10 bg-paper-deep/40">
        <div className="editorial-grid py-12 md:py-16">
          <p className="col-span-12 text-xs tracking-[0.3em] uppercase text-bronze md:col-span-2">
            Manifesto
          </p>
          <h2 className="font-display col-span-12 text-2xl leading-snug md:col-span-7 md:text-4xl">
            Built to age gracefully in real homes — solid timber, honest textiles, finishes you can
            repair, not replace.
          </h2>
          <div className="col-span-12 mt-6 md:col-span-3 md:mt-0">
            <p className="text-sm leading-relaxed text-ink-soft">
              Every piece lists its materials, dimensions, weight and care. Every price is clear
              — what you see is what you pay on arrival.
            </p>
            <Link
              href="/shop"
              className="rounded-pill mt-5 inline-block border border-ink/20 px-5 py-2.5 text-sm hover:border-bronze"
            >
              Start with Living Room
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { EASE_EXPO } from "./Reveal";
import { Folio, MotifMark } from "./Editorial";

type HeroProps = {
  productCount: number;
  featuredCount: number;
};

function MaskLine({ text, delay, className = "" }: { text: string; delay: number; className?: string }) {
  return (
    <span className="block overflow-hidden pb-[0.08em]">
      <motion.span
        className={`block ${className}`}
        initial={{ y: "110%" }}
        animate={{ y: "0%" }}
        transition={{ duration: 1.1, delay, ease: [...EASE_EXPO] }}
      >
        {text}
      </motion.span>
    </span>
  );
}

const HERO_IMG =
  "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=80";

/**
 * Phase 3 hero — folio strip + headline + object.
 * The object is an arched figure (bronze hairline offset frame,
 * Fig. caption) so the page opens on craft, not on stats cards.
 * Motion is transform/opacity only; reduced-motion handled globally.
 */
export function Hero({ productCount, featuredCount }: HeroProps) {
  return (
    <section aria-label="Introduction" className="border-b border-ink/10">
      <div className="editorial-grid pt-8 md:pt-12">
        <div className="col-span-12 flex items-center justify-between gap-4 border-b border-ink/10 pb-4">
          <Folio index="01" label="Vol. I — The Warm Minimal Edit" />
          <p className="hidden text-[11px] tracking-[0.28em] uppercase text-ink-mute sm:block">
            Lagos · Cash on delivery
          </p>
        </div>
      </div>

      <div className="editorial-grid items-end pt-8 pb-10 md:pt-12 md:pb-14">
        <div className="col-span-12 md:col-span-7">
          <motion.p
            className="flex items-center gap-2 text-xs tracking-[0.3em] uppercase text-bronze"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [...EASE_EXPO] }}
          >
            <MotifMark className="h-4 w-4" />
            Maison · Home &amp; Living · {productCount} pieces
          </motion.p>
          <h1 className="font-display mt-5 text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.98] tracking-tight">
            <MaskLine text="Rooms that read" delay={0.1} />
            <MaskLine text="like literature." delay={0.22} className="text-ink-soft italic" />
          </h1>
          <motion.p
            className="mt-6 max-w-prose text-base leading-relaxed text-ink-soft md:text-lg"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: [...EASE_EXPO] }}
          >
            Small-batch furniture, lighting and textiles — {featuredCount} editors&rsquo;
            picks this season, each with materials, dimensions and care notes.
          </motion.p>
          <motion.div
            className="mt-8 flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.52, ease: [...EASE_EXPO] }}
          >
            <Link
              href="/shop"
              className="rounded-pill bg-ink px-6 py-3 text-sm text-cream transition-transform duration-200 hover:-translate-y-0.5"
            >
              Browse the catalog
            </Link>
            <Link
              href="/shop?sort=featured"
              className="rounded-pill border border-bronze/40 px-6 py-3 text-sm text-bronze-deep transition-colors hover:border-bronze"
            >
              Shop featured
            </Link>
          </motion.div>

          {/* Ledger stats — ruled row, not cards */}
          <motion.dl
            className="mt-10 grid grid-cols-3 gap-6 border-t border-ink/10 pt-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6, ease: [...EASE_EXPO] }}
          >
            {[
              [`${productCount}`, "pieces in catalog"],
              [`${featuredCount}`, "featured stories"],
              ["COD", "pay the rider"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="sr-only">{l}</dt>
                <dd className="font-display text-2xl md:text-4xl">{v}</dd>
                <dd className="mt-1 text-[11px] tracking-[0.18em] uppercase text-ink-mute">{l}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        {/* Object — arched figure with offset bronze frame */}
        <motion.figure
          className="col-span-12 mt-10 md:col-span-4 md:col-start-9 md:mt-0"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.45, ease: [...EASE_EXPO] }}
        >
          <div className="relative">
            <div aria-hidden className="absolute -inset-2 rounded-t-full rounded-b-lg border border-bronze/40" />
            <div className="relative aspect-[3/4] overflow-hidden rounded-t-full rounded-b-lg bg-linen">
              <Image
                src={HERO_IMG}
                alt="Oak-framed sofa with woven cushions in a warm living room"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
            </div>
            <span
              aria-hidden
              className="absolute -top-3 right-6 rounded-full border border-bronze/40 bg-paper px-3 py-1 text-[11px] tracking-[0.2em] uppercase text-bronze-deep"
            >
              N° 01
            </span>
          </div>
          <figcaption className="mt-4 flex items-start justify-between gap-4 border-t border-ink/10 pt-3">
            <p className="text-sm leading-relaxed text-ink-soft">
              <span className="font-display text-ink italic">Fig. 01 — </span>
              Oak lounge, woven rattan. Priced at today&rsquo;s rate — frozen on your order.
            </p>
            <span className="shrink-0 text-bronze">
              <MotifMark className="h-5 w-5" />
            </span>
          </figcaption>
        </motion.figure>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { EASE_EXPO } from "./Reveal";

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

export function Hero({ productCount, featuredCount }: HeroProps) {
  return (
    <section className="editorial-grid items-end pt-14 pb-10 md:pt-20 md:pb-14">
      <div className="col-span-12 md:col-span-7">
        <motion.p
          className="text-xs tracking-[0.3em] uppercase text-bronze"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [...EASE_EXPO] }}
        >
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
      </div>
      <div className="col-span-12 mt-10 md:col-span-4 md:col-start-9 md:mt-0">
        <motion.dl
          className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-ink/10 bg-ink/10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: [...EASE_EXPO] }}
        >
          {[
            [`${productCount}`, "pieces in catalog"],
            [`${featuredCount}`, "featured stories"],
          ].map(([v, l]) => (
            <div key={l} className="bg-cream px-5 py-6">
              <dt className="sr-only">{l}</dt>
              <dd className="font-display text-3xl md:text-4xl">{v}</dd>
              <dd className="mt-1 text-xs tracking-[0.18em] uppercase text-ink-mute">{l}</dd>
            </div>
          ))}
        </motion.dl>
        <p className="mt-4 text-sm leading-relaxed text-ink-mute">
          Cash on delivery · Priced clearly, settled at today&apos;s rate.
        </p>
      </div>
    </section>
  );
}

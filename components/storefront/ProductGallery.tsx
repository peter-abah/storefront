"use client";

import Image from "next/image";
import { useState } from "react";
import { MotifMark } from "./Editorial";

type ProductGalleryProps = {
  images: { url: string }[];
  name: string;
};

/**
 * Phase 3 gallery — a figure with folio caption.
 * Prev/next + numbered plates, main frame with bronze hairline.
 * State logic unchanged (active index); motion is transform/opacity only.
 */
export function ProductGallery({ images, name }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const current = images[Math.min(active, images.length - 1)];
  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg bg-linen text-sm text-ink-mute">
        <MotifMark className="h-5 w-5 text-bronze" />
        Photography to come
      </div>
    );
  }
  const idx = Math.min(active, images.length - 1);
  const go = (dir: 1 | -1) =>
    setActive((a) => (a + dir + images.length) % images.length);

  return (
    <figure>
      <div className="relative">
        <div aria-hidden className="absolute -inset-1.5 rounded-lg border border-bronze/40" />
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-linen">
          {current ? (
            <Image
              key={current.url}
              src={current.url}
              alt={`${name} — image ${idx + 1}`}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover"
            />
          ) : null}
          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous image"
                className="rounded-pill absolute top-1/2 left-3 -translate-y-1/2 border border-ink/15 bg-paper/90 px-3 py-1.5 text-sm transition-transform duration-200 hover:-translate-y-[calc(50%+2px)]"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next image"
                className="rounded-pill absolute top-1/2 right-3 -translate-y-1/2 border border-ink/15 bg-paper/90 px-3 py-1.5 text-sm transition-transform duration-200 hover:-translate-y-[calc(50%+2px)]"
              >
                →
              </button>
            </>
          ) : null}
        </div>
      </div>
      <figcaption className="mt-3 flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
        <p className="text-sm text-ink-soft">
          <span className="font-display italic text-ink">
            Fig. {String(idx + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
          </span>{" "}
          — {name}
        </p>
        <span aria-hidden className="text-bronze">
          <MotifMark className="h-4 w-4" />
        </span>
      </figcaption>
      {images.length > 1 ? (
        <ul className="mt-3 grid grid-cols-4 gap-2">
          {images.map((img, i) => (
            <li key={`${img.url}-${i}`}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1} of ${name}`}
                aria-pressed={i === active}
                className={`relative aspect-[4/3] w-full overflow-hidden rounded-md bg-linen ring-ink/10 outline-offset-2 ${
                  i === active ? "ring-2 ring-bronze" : "opacity-70 ring-1 hover:opacity-100"
                }`}
              >
                <Image
                  src={img.url}
                  alt=""
                  fill
                  sizes="25vw"
                  className="object-cover"
                  loading="lazy"
                />
                <span className="absolute bottom-1 left-1.5 text-[10px] tracking-[0.18em] text-cream">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}

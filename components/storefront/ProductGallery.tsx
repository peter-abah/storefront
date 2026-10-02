"use client";

import Image from "next/image";
import { useState } from "react";

type ProductGalleryProps = {
  images: { url: string }[];
  name: string;
};

export function ProductGallery({ images, name }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const current = images[Math.min(active, images.length - 1)];
  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-linen text-sm text-ink-mute">
        Photography to come
      </div>
    );
  }
  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-linen">
        {current ? (
          <Image
            key={current.url}
            src={current.url}
            alt={`${name} — image ${Math.min(active, images.length - 1) + 1}`}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-cover"
          />
        ) : null}
      </div>
      {images.length > 1 ? (
        <ul className="mt-3 grid grid-cols-4 gap-2">
          {images.map((img, i) => (
            <li key={`${img.url}-${i}`}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1} of ${name}`}
                aria-pressed={i === active}
                className={`relative aspect-[4/3] w-full overflow-hidden rounded-md bg-linen outline-offset-2 ${
                  i === active ? "outline-2 outline-bronze" : "opacity-70 hover:opacity-100"
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
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

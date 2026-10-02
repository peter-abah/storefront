"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { addToCart } from "@/lib/actions/cart";
import { addGuestLine } from "@/lib/cart-local";
import { notifyCartUpdated, openCartDrawer } from "@/lib/cart-events";

type AddToCartProps = {
  productId: string;
  stock: number;
  /** compact: single Add button (cards). full: qty stepper + Add (PDP). */
  mode?: "compact" | "full";
};

export function AddToCart({ productId, stock, mode = "compact" }: AddToCartProps) {
  const { data: session } = useSession();
  const [qty, setQty] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (stock <= 0) return null;

  const max = Math.min(stock, 99);

  async function add() {
    setPending(true);
    setError(null);
    try {
      const n = mode === "full" ? qty : 1;
      if (session?.user) {
        const res = await addToCart({ productId, qty: n });
        if (!res.ok) {
          setError(res.message);
          return;
        }
      } else {
        addGuestLine(productId, n);
      }
      notifyCartUpdated();
      openCartDrawer();
    } finally {
      setPending(false);
    }
  }

  if (mode === "compact") {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={add}
          disabled={pending}
          aria-label="Add to cart"
          className="rounded-pill bg-ink px-4 py-1.5 text-xs text-cream transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add to cart"}
        </button>
        {error ? (
          <span role="alert" className="text-[11px] text-clay">
            {error}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex items-center rounded-pill border border-ink/20"
          role="group"
          aria-label="Quantity"
        >
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={pending || qty <= 1}
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="px-3 py-2 text-lg leading-none disabled:opacity-40"
          >
            −
          </button>
          <span aria-live="polite" className="min-w-8 text-center text-sm font-medium">
            {qty}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={pending || qty >= max}
            onClick={() => setQty((q) => Math.min(max, q + 1))}
            className="px-3 py-2 text-lg leading-none disabled:opacity-40"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="rounded-pill bg-ink px-6 py-2.5 text-sm text-cream transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add to cart"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-clay">
          {error}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import {
  getActiveCurrencies,
  getCart,
  getCartProducts,
  removeLine,
  updateQty,
} from "@/lib/actions/cart";
import { formatDisplay, toDisplay, type MoneyCurrency } from "@/lib/money";
import {
  getGuestCart,
  removeGuestLine,
  updateGuestQty,
} from "@/lib/cart-local";
import { notifyCartUpdated } from "@/lib/cart-events";

type Line = {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  unitBaseCents: number;
  qty: number;
  stock: number;
  lineBaseCents: number;
  clamped: boolean;
};

type CurrencyRow = MoneyCurrency & {
  rateToBase: string;
  isBase: boolean;
};

function priceOf(baseCents: number, currency: CurrencyRow | null): string {
  if (!currency) return `${(baseCents / 100).toFixed(2)}`;
  return formatDisplay(toDisplay(baseCents, currency.rateToBase), currency);
}

/**
 * Shared cart list + summary, used by both the slide-over drawer and the
 * full /cart page ("full page mirror"). Loads fresh server state on mount
 * and on every `maison:cart-updated` event.
 */
export function CartView({ variant }: { variant: "drawer" | "page" }) {
  const { data: session, isPending } = useSession();
  const [lines, setLines] = useState<Line[]>([]);
  const [currency, setCurrency] = useState<CurrencyRow | null>(null);
  const [clampedCount, setClampedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const curRes = await getActiveCurrencies();
      const rows = (curRes.ok ? curRes.data : []) as CurrencyRow[];
      const cur = rows.find((c) => c.isBase) ?? rows[0] ?? null;
      setCurrency(cur);

      if (session?.user) {
        const res = await getCart();
        if (!res.ok) {
          setError(res.message);
          setLines([]);
          return;
        }
        setLines(res.data.lines);
        setClampedCount(res.data.lines.filter((l) => l.clamped).length);
      } else if (!isPending) {
        // Guest: enrich local qtys with live product snapshots.
        const guest = getGuestCart();
        if (guest.length === 0) {
          setLines([]);
          setClampedCount(0);
          return;
        }
        const snap = await getCartProducts(guest.map((g) => g.productId));
        const byId = new Map(
          (snap.ok ? snap.data : []).map((p) => [p.id, p]),
        );
        const merged: Line[] = [];
        let clamped = 0;
        for (const g of guest) {
          const p = byId.get(g.productId);
          if (!p || p.stock <= 0) {
            clamped += 1;
            merged.push({
              productId: g.productId,
              slug: "",
              name: "No longer available",
              image: null,
              unitBaseCents: 0,
              qty: 0,
              stock: 0,
              lineBaseCents: 0,
              clamped: true,
            });
            continue;
          }
          const qty = Math.min(g.qty, p.stock);
          if (qty < g.qty) clamped += 1;
          merged.push({
            productId: p.id,
            slug: p.slug,
            name: p.name,
            image: p.images[0]?.url ?? null,
            unitBaseCents: p.priceBaseCents,
            qty,
            stock: p.stock,
            lineBaseCents: p.priceBaseCents * qty,
            clamped: qty < g.qty,
          });
        }
        setLines(merged);
        setClampedCount(clamped);
      }
    } catch {
      setError("Could not load your cart — try again.");
    } finally {
      setLoading(false);
    }
  }, [session, isPending]);

  useEffect(() => {
    setLoading(true);
    void load();
    window.addEventListener("maison:cart-updated", load);
    return () => window.removeEventListener("maison:cart-updated", load);
  }, [load]);

  async function setLineQty(line: Line, qty: number) {
    setBusyId(line.productId);
    setError(null);
    try {
      if (session?.user) {
        const res = await updateQty({ productId: line.productId, qty });
        if (!res.ok) setError(res.message);
      } else {
        updateGuestQty(line.productId, qty);
      }
      notifyCartUpdated();
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(line: Line) {
    setBusyId(line.productId);
    try {
      if (session?.user) {
        await removeLine(line.productId);
      } else {
        removeGuestLine(line.productId);
      }
      notifyCartUpdated();
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const subtotal = lines.reduce((n, l) => n + l.lineBaseCents, 0);
  const count = lines.reduce((n, l) => n + l.qty, 0);

  if (loading) {
    return (
      <div aria-busy className="flex flex-col gap-3 py-6" aria-label="Loading cart">
        {[0, 1].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-md bg-ink/5" />
        ))}
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-xs tracking-[0.28em] uppercase text-bronze">Empty cart</p>
        <h2 className="font-display mt-3 text-2xl">
          {variant === "page" ? "Your selection is empty — for now." : "Nothing here yet."}
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
          {variant === "page"
            ? "Explore Living Room and lighting — pay on delivery when the rider arrives."
            : "Browse the catalog and add a piece — it will appear here."}
        </p>
        <Link
          href="/shop?room=living"
          className="rounded-pill mt-6 inline-block bg-ink px-6 py-2.5 text-sm text-cream"
        >
          Explore Living Room icons
        </Link>
      </div>
    );
  }

  return (
    <div>
      {clampedCount > 0 ? (
        <p role="status" className="mb-4 rounded-md bg-clay/10 p-3 text-sm text-clay">
          Stock shifted while you browsed — we&apos;ve kept only what&apos;s available (
          {clampedCount} {clampedCount === 1 ? "item" : "items"}).
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 rounded-md bg-clay/10 p-3 text-sm text-clay">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {lines.map((l) => (
          <li
            key={l.productId}
            className="flex gap-4 rounded-lg border border-ink/10 bg-cream p-3"
          >
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-linen">
              {l.image ? (
                <Image
                  src={l.image}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                  loading="lazy"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              {l.slug ? (
                <Link
                  href={`/product/${l.slug}`}
                  className="font-display line-clamp-1 text-[15px] hover:text-bronze-deep"
                >
                  {l.name}
                </Link>
              ) : (
                <p className="font-display line-clamp-1 text-[15px] text-ink-mute">{l.name}</p>
              )}
              <p className="mt-0.5 text-sm text-ink-soft">{priceOf(l.unitBaseCents, currency)} each</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div
                  className="flex items-center rounded-pill border border-ink/15"
                  role="group"
                  aria-label={`Quantity for ${l.name}`}
                >
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    disabled={busyId === l.productId || l.qty <= 1}
                    onClick={() => setLineQty(l, l.qty - 1)}
                    className="px-2.5 py-1 text-base leading-none disabled:opacity-40"
                  >
                    −
                  </button>
                  <span aria-live="polite" className="min-w-6 text-center text-sm font-medium">
                    {l.qty}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    disabled={busyId === l.productId || l.qty >= Math.min(l.stock, 99)}
                    onClick={() => setLineQty(l, l.qty + 1)}
                    className="px-2.5 py-1 text-base leading-none disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <p className="text-sm font-medium">{priceOf(l.lineBaseCents, currency)}</p>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[11px] text-ink-mute">
                  {l.stock <= 0
                    ? "Out of stock"
                    : l.stock <= 5
                      ? `Only ${l.stock} left`
                      : "In stock"}
                </span>
                <button
                  type="button"
                  onClick={() => remove(l)}
                  disabled={busyId === l.productId}
                  className="text-xs text-ink-mute underline-offset-4 hover:text-clay hover:underline disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-5 border-t border-ink/10 pt-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-ink-soft">
            Subtotal ({count} {count === 1 ? "item" : "items"})
          </p>
          <p className="font-display text-xl">{priceOf(subtotal, currency)}</p>
        </div>
        <p className="mt-1 text-xs text-ink-mute">
          Delivery calculated at checkout by area.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Link
            href="/checkout"
            className="rounded-pill bg-ink px-6 py-3 text-center text-sm text-cream transition-transform duration-200 hover:-translate-y-0.5"
          >
            Continue to checkout
          </Link>
          {variant === "drawer" ? (
            <Link
              href="/cart"
              className="rounded-pill border border-ink/20 px-6 py-2.5 text-center text-sm hover:border-bronze"
            >
              View full cart
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

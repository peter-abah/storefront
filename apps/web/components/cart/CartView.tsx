"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import {
  addToCart,
  getActiveCurrencies,
  getCart,
  getCartProducts,
  removeLine,
  updateQty,
} from "@/lib/actions/cart";
import { formatDisplay, toDisplay, type MoneyCurrency } from "@/lib/money";
import {
  getGuestCart,
  isStorageFullError,
  removeGuestLine,
  setGuestCart,
  updateGuestQty,
  type GuestLine,
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
export function CartView({
  variant,
  onNavigate,
}: {
  variant: "drawer" | "page";
  onNavigate?: () => void;
}) {
  const { data: session, isPending } = useSession();
  const [lines, setLines] = useState<Line[]>([]);
  const [currency, setCurrency] = useState<CurrencyRow | null>(null);
  const [clampedCount, setClampedCount] = useState(0);
  const [removedCount, setRemovedCount] = useState(0);
  const [removedNames, setRemovedNames] = useState<string[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [dismissedRemoved, setDismissedRemoved] = useState(false);
  const [purged, setPurged] = useState<null | {
    count: number;
    guestSnapshot: GuestLine[];
    authSnapshot: { productId: string; qty: number }[];
  }>(null);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setUnauthenticated(false);
    try {
      const curRes = await getActiveCurrencies();
      const rows = (curRes.ok ? curRes.data : []) as CurrencyRow[];
      const cur = rows.find((c) => c.isBase) ?? rows[0] ?? null;
      setCurrency(cur);

      if (session?.user) {
        const res = await getCart();
        if (!res.ok) {
          if (res.code === "UNAUTHENTICATED") setUnauthenticated(true);
          setError(res.message);
          setLines([]);
          return;
        }
        setLines(res.data.lines);
        setClampedCount(res.data.lines.filter((l) => l.clamped && l.stock > 0).length);
        setRemovedCount(res.data.removedCount ?? 0);
        setRemovedNames(res.data.removedNames ?? []);
        setRemovedIds(res.data.removedIds ?? []);
        setOutOfStockCount(res.data.outOfStockCount ?? 0);
      } else if (!isPending) {
        // Guest: enrich local qtys with live product snapshots.
        const guest = getGuestCart();
        if (guest.length === 0) {
          setLines([]);
          setClampedCount(0);
          setRemovedCount(0);
          setRemovedNames([]);
          setRemovedIds([]);
          setOutOfStockCount(0);
          return;
        }
        const snap = await getCartProducts(guest.map((g) => g.productId));
        const byId = new Map(
          (snap.ok ? snap.data : []).map((p) => [p.id, p]),
        );
        const merged: Line[] = [];
        let clamped = 0;
        let oos = 0;
        const goneNames: string[] = [];
        const goneIds: string[] = [];
        for (const g of guest) {
          const p = byId.get(g.productId);
          if (!p || (p as { active?: boolean }).active === false) {
            // Hidden or deleted — excluded from display, surfaced in banner.
            goneNames.push(p && (p as { name?: string }).name ? String((p as { name?: string }).name) : "Removed product");
            goneIds.push(g.productId);
            continue;
          }
          if (p.stock <= 0) {
            oos += 1;
            merged.push({
              productId: p.id,
              slug: p.slug,
              name: p.name,
              image: p.images[0]?.url ?? null,
              unitBaseCents: p.priceBaseCents,
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
        setRemovedCount(goneIds.length);
        setRemovedNames(goneNames);
        setRemovedIds(goneIds);
        setOutOfStockCount(oos);
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
    setUnauthenticated(false);
    try {
      if (session?.user) {
        const res = await updateQty({ productId: line.productId, qty });
        if (!res.ok) {
          if (res.code === "UNAUTHENTICATED") setUnauthenticated(true);
          setError(res.message);
        }
      } else {
        try {
          updateGuestQty(line.productId, qty);
        } catch (e) {
          if (isStorageFullError(e)) setError(e.message);
          else throw e;
        }
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
        try {
          removeGuestLine(line.productId);
        } catch (e) {
          if (isStorageFullError(e)) setError(e.message);
        }
      }
      notifyCartUpdated();
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function removeUnavailable() {
    setPurgeBusy(true);
    setError(null);
    try {
      const oosIds = lines.filter((l) => l.stock <= 0).map((l) => l.productId);
      const authSnapshot = lines
        .filter((l) => l.stock <= 0)
        .map((l) => ({ productId: l.productId, qty: Math.max(1, l.qty) }));
      const guestSnapshot = getGuestCart();
      if (session?.user) {
        for (const id of [...removedIds, ...oosIds]) {
          await removeLine(id);
        }
      } else {
        const keep = guestSnapshot.filter(
          (g) => !removedIds.includes(g.productId) && !oosIds.includes(g.productId),
        );
        try {
          setGuestCart(keep);
        } catch (e) {
          if (isStorageFullError(e)) setError(e.message);
        }
      }
      const count = (session?.user ? removedIds.length + oosIds.length : removedIds.length + oosIds.length);
      setPurged({ count, guestSnapshot, authSnapshot });
      setDismissedRemoved(true);
      notifyCartUpdated();
      await load();
    } finally {
      setPurgeBusy(false);
    }
  }

  async function undoPurge() {
    if (!purged) return;
    setPurgeBusy(true);
    setError(null);
    try {
      if (session?.user) {
        let restored = 0;
        let failed = 0;
        for (const s of purged.authSnapshot) {
          const res = await addToCart({ productId: s.productId, qty: s.qty });
          if (res.ok) restored += 1;
          else failed += 1;
        }
        // Hidden pieces can't be restored until re-activated — surface honestly.
        if (failed > 0 && restored === 0) {
          setError("Those pieces are still unavailable, so they can't be restored yet.");
        }
        if (restored > 0) setPurged(null);
      } else {
        try {
          setGuestCart(purged.guestSnapshot);
          setPurged(null);
        } catch (e) {
          if (isStorageFullError(e)) setError(e.message);
        }
      }
      setDismissedRemoved(false);
      notifyCartUpdated();
      await load();
    } finally {
      setPurgeBusy(false);
    }
  }

  const subtotal = lines.reduce((n, l) => n + l.lineBaseCents, 0);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const unavailableCount = removedCount + outOfStockCount;
  const removedLabel =
    removedNames.length > 0
      ? removedNames.slice(0, 3).join(", ") + (removedNames.length > 3 ? ` and ${removedNames.length - 3} more` : "")
      : "";

  if (loading) {
    return (
      <div aria-busy className="flex flex-col gap-3 py-6" aria-label="Loading cart">
        {[0, 1].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-md bg-ink/5" />
        ))}
      </div>
    );
  }

  const signInAgain = unauthenticated ? (
    <p role="alert" className="mb-4 rounded-md bg-clay/10 p-3 text-sm text-clay">
      Your session expired —{" "}
      <Link
        href="/login?callbackURL=%2Fcart"
        onClick={onNavigate}
        className="font-medium text-bronze-deep underline underline-offset-4"
      >
        sign in again
      </Link>{" "}
      to see your cart.
    </p>
  ) : null;

  if (lines.length === 0 && removedCount === 0) {
    return (
      <div className="border-t-2 border-ink bg-cream px-6 py-10 text-center">
        {signInAgain}
        {purged && purged.count > 0 ? (
          <p role="status" className="mx-auto mb-4 max-w-sm rounded-md bg-moss/10 p-3 text-sm text-ink">
            Removed {purged.count} unavailable {purged.count === 1 ? "item" : "items"}.{" "}
            <button type="button" onClick={undoPurge} disabled={purgeBusy} className="font-medium text-bronze-deep underline underline-offset-4 disabled:opacity-50">
              Undo
            </button>{" "}
            ·{" "}
            <Link href="/shop" onClick={onNavigate} className="font-medium text-bronze-deep underline underline-offset-4">
              Continue shopping
            </Link>
          </p>
        ) : null}
        <p className="text-[11px] tracking-[0.28em] uppercase text-bronze">Empty cart — N° 00</p>
        <h2 className="font-display mx-auto mt-3 max-w-sm text-2xl leading-tight tracking-tight">
          Your selection is empty — for now.
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
          Every room starts with one piece. Explore Living Room and lighting — pay on delivery when the rider arrives.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/shop?room=living"
            onClick={onNavigate}
            className="rounded-pill bg-ink px-6 py-2.5 text-sm text-cream transition-transform duration-200 hover:-translate-y-0.5"
          >
            Explore Living Room pieces
          </Link>
          <Link
            href="/shop"
            onClick={onNavigate}
            className="rounded-pill border border-ink/15 px-5 py-2.5 text-sm hover:border-bronze"
          >
            Browse all pieces
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {signInAgain}
      {!dismissedRemoved && removedCount > 0 ? (
        <div role="status" className="mb-4 rounded-md bg-clay/10 p-3 text-sm text-clay">
          <p>
            {removedCount} {removedCount === 1 ? "item was" : "items were"} removed — no longer available
            {removedLabel ? (
              <>
                {" "}(<span className="font-medium">{removedLabel}</span>)
              </>
            ) : null}
            .
          </p>
          <p className="mt-2 flex flex-wrap gap-3 text-xs">
            <Link href="/shop" onClick={onNavigate} className="font-medium text-bronze-deep underline underline-offset-4">
              Continue shopping
            </Link>
            <button
              type="button"
              onClick={() => setDismissedRemoved(true)}
              className="font-medium text-bronze-deep underline underline-offset-4"
            >
              Dismiss
            </button>
          </p>
        </div>
      ) : null}
      {outOfStockCount > 0 ? (
        <div role="status" className="mb-4 rounded-md bg-bronze/10 p-3 text-sm text-ink">
          <p>
            {outOfStockCount} {outOfStockCount === 1 ? "item is" : "items are"} out of stock and
            can&apos;t be checked out.
          </p>
          <button
            type="button"
            onClick={removeUnavailable}
            disabled={purgeBusy}
            className="rounded-pill mt-2 border border-ink/20 px-4 py-1.5 text-xs hover:border-bronze disabled:opacity-50"
          >
            {purgeBusy ? "Removing…" : "Remove unavailable"}
          </button>
        </div>
      ) : removedCount > 0 && !dismissedRemoved ? (
        <div className="mb-4">
          <button
            type="button"
            onClick={removeUnavailable}
            disabled={purgeBusy}
            className="rounded-pill border border-ink/20 px-4 py-1.5 text-xs hover:border-bronze disabled:opacity-50"
          >
            {purgeBusy ? "Removing…" : "Remove unavailable"}
          </button>
        </div>
      ) : null}
      {purged && purged.count > 0 ? (
        <p role="status" className="mb-4 rounded-md bg-moss/10 p-3 text-sm text-ink">
          Removed {purged.count} unavailable {purged.count === 1 ? "item" : "items"}.{" "}
          <button type="button" onClick={undoPurge} disabled={purgeBusy} className="font-medium text-bronze-deep underline underline-offset-4 disabled:opacity-50">
            Undo
          </button>{" "}
          ·{" "}
          <Link href="/shop" onClick={onNavigate} className="font-medium text-bronze-deep underline underline-offset-4">
            Continue shopping
          </Link>
        </p>
      ) : null}
      {clampedCount > 0 ? (
        <p role="status" className="mb-4 rounded-md bg-clay/10 p-3 text-sm text-clay">
          Stock shifted while you browsed — we&apos;ve kept only what&apos;s available (
          {clampedCount} {clampedCount === 1 ? "item" : "items"}).
        </p>
      ) : null}
      {error && !unauthenticated ? (
        <p role="alert" className="mb-4 rounded-md bg-clay/10 p-3 text-sm text-clay">
          {error}
        </p>
      ) : null}

      {lines.length === 0 && removedCount > 0 ? (
        <div className="py-6 text-center">
          <p className="text-xs tracking-[0.28em] uppercase text-bronze">Unavailable only</p>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
            Everything left in your bag is unavailable right now. Remove them to start fresh.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={removeUnavailable}
              disabled={purgeBusy}
              className="rounded-pill bg-ink px-5 py-2 text-sm text-cream disabled:opacity-50"
            >
              {purgeBusy ? "Removing…" : "Remove unavailable"}
            </button>
            <Link
              href="/shop"
              onClick={onNavigate}
              className="rounded-pill border border-ink/20 px-5 py-2 text-sm"
            >
              Continue shopping
            </Link>
          </div>
        </div>
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
                  onClick={onNavigate}
                  className="font-display line-clamp-1 text-[15px] hover:text-bronze-deep"
                >
                  {l.name}
                </Link>
              ) : (
                <p className="font-display line-clamp-1 text-[15px] text-ink-mute">{l.name}</p>
              )}
              <p className="mt-0.5 text-sm text-ink-soft">{priceOf(l.unitBaseCents, currency)} each</p>
              {l.stock <= 0 ? (
                <p role="status" className="mt-1 text-xs font-medium text-clay">
                  Out of stock — remove to check out.
                </p>
              ) : null}
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

      {lines.length > 0 ? (
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
              onClick={onNavigate}
              className="rounded-pill bg-ink px-6 py-3 text-center text-sm text-cream transition-transform duration-200 hover:-translate-y-0.5"
            >
              Continue to checkout
            </Link>
            {variant === "drawer" ? (
              <Link
                href="/cart"
                onClick={onNavigate}
                className="rounded-pill border border-ink/20 px-6 py-2.5 text-center text-sm hover:border-bronze"
              >
                View full cart
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
      {unavailableCount > 0 && lines.length > 0 ? (
        <p className="mt-3 text-center text-xs text-ink-mute">
          <Link href="/shop" onClick={onNavigate} className="text-bronze-deep underline underline-offset-4">
            Continue shopping
          </Link>{" "}
          for available pieces.
        </p>
      ) : null}
    </div>
  );
}

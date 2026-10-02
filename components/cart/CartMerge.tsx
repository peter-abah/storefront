"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { mergeGuestCart } from "@/lib/actions/cart";
import { clearGuestCart, getGuestCart } from "@/lib/cart-local";
import { notifyCartUpdated } from "@/lib/cart-events";

type Notice = { merged: number; skipped: number };

/**
 * On sign-in, sum the localStorage guest cart into the DB cart
 * (qty summed, clamped to stock server-side) then clear storage.
 * Surfaces merged/skipped counts so inactive/OOS drops are visible.
 * The mergedFor guard only marks after a non-empty attempt, so an
 * empty-guest first login never blocks later merges; it resets on
 * sign-out.
 */
export function CartMerge() {
  const { data: session } = useSession();
  const mergedFor = useRef<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const user = session?.user as { id?: string } | undefined;
    const uid = user?.id;
    if (!uid) {
      mergedFor.current = null;
      return;
    }
    if (mergedFor.current === uid) return;

    const guest = getGuestCart();
    // Empty guest: don't mark — a later login with items must still merge.
    if (guest.length === 0) return;
    mergedFor.current = uid;

    mergeGuestCart(guest).then((res) => {
      if (res.ok) {
        clearGuestCart();
        notifyCartUpdated();
        if (res.data.merged > 0 || res.data.skipped > 0) {
          setNotice({ merged: res.data.merged, skipped: res.data.skipped });
        }
      } else {
        // Keep the guest cart for a retry; badge still shows local items.
        mergedFor.current = null;
      }
    });
  }, [session]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(t);
  }, [notice]);

  if (!notice) return null;

  const { merged, skipped } = notice;
  const text =
    merged > 0 && skipped > 0
      ? `Cart merged — ${merged} ${merged === 1 ? "item" : "items"} added, ${skipped} skipped (no longer available or out of stock).`
      : merged > 0
        ? `Welcome back — ${merged} ${merged === 1 ? "item" : "items"} from your guest cart merged.`
        : `${skipped} ${skipped === 1 ? "item" : "items"} couldn't be merged (inactive or out of stock).`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 bottom-4 z-[60] flex max-w-sm items-start gap-3 rounded-lg border border-ink/10 bg-ink px-4 py-3 text-sm text-cream shadow-lift"
    >
      <p className="flex-1 leading-relaxed">{text}</p>
      <button
        type="button"
        onClick={() => setNotice(null)}
        aria-label="Dismiss cart merge notice"
        className="rounded-pill border border-cream/30 px-2 py-0.5 text-xs hover:border-cream"
      >
        ✕
      </button>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { getCart } from "@/lib/actions/cart";
import { guestCount } from "@/lib/cart-local";
import { openCartDrawer } from "@/lib/cart-events";

export function CartBadge() {
  const { data: session, isPending } = useSession();
  const [count, setCount] = useState(0);
  const [expired, setExpired] = useState(false);

  const refresh = useCallback(async () => {
    if (session?.user) {
      const res = await getCart();
      if (!res.ok && res.code === "UNAUTHENTICATED") {
        // Stale client session: cookie expired server-side.
        setExpired(true);
        setCount(0);
        return;
      }
      setExpired(false);
      setCount(res.ok ? res.data.count : 0);
    } else if (!isPending) {
      setExpired(false);
      setCount(guestCount());
    }
  }, [session, isPending]);

  useEffect(() => {
    void refresh();
    window.addEventListener("maison:cart-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("maison:cart-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={openCartDrawer}
        aria-label={count > 0 ? `Open cart, ${count} items` : "Open cart, empty"}
        className="rounded-pill relative border border-ink/20 px-4 py-1.5 text-sm hover:border-bronze"
      >
        Cart
        {count > 0 ? (
          <span
            aria-hidden
            className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-bronze px-1 text-[11px] font-medium text-cream"
          >
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>
      {expired ? (
        <Link
          href="/login?callbackURL=%2Fcart"
          className="text-xs text-bronze-deep underline underline-offset-4"
        >
          Sign in again
        </Link>
      ) : null}
    </span>
  );
}

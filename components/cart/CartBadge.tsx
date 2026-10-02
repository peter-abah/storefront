"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { getCart } from "@/lib/actions/cart";
import { guestCount } from "@/lib/cart-local";
import { openCartDrawer } from "@/lib/cart-events";

export function CartBadge() {
  const { data: session, isPending } = useSession();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (session?.user) {
      const res = await getCart();
      setCount(res.ok ? res.data.count : 0);
    } else if (!isPending) {
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
  );
}

"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/lib/auth-client";
import { mergeGuestCart } from "@/lib/actions/cart";
import { clearGuestCart, getGuestCart } from "@/lib/cart-local";
import { notifyCartUpdated } from "@/lib/cart-events";

/**
 * On sign-in, sum the localStorage guest cart into the DB cart
 * (qty summed, clamped to stock server-side) then clear storage.
 */
export function CartMerge() {
  const { data: session } = useSession();
  const mergedFor = useRef<string | null>(null);

  useEffect(() => {
    const user = session?.user as { id?: string } | undefined;
    const uid = user?.id;
    if (!uid || mergedFor.current === uid) return;
    mergedFor.current = uid;

    const guest = getGuestCart();
    if (guest.length === 0) return;

    mergeGuestCart(guest).then((res) => {
      if (res.ok) {
        clearGuestCart();
        notifyCartUpdated();
      } else {
        // Keep the guest cart for a retry; badge still shows local items.
        mergedFor.current = null;
      }
    });
  }, [session]);

  return null;
}

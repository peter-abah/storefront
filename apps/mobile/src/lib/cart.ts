import type {
  CartDTO,
  CartLineDTO,
  CartMutationResultDTO,
  CartRemoveResultDTO,
  GuestCartProductDTO,
} from "@maison/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import {
  addCartItem,
  ApiError,
  getCart,
  getCartProducts,
  mergeCart,
  removeCartItem,
  updateCartItem,
} from "./api";
import {
  addGuestLine,
  clearGuestLines,
  getGuestLines,
  removeGuestLine,
  updateGuestLine,
  type GuestLine,
} from "./guest-cart";
import { useSession } from "./session";

export const CART_QUERY_KEY = ["cart"] as const;

const CART_PRODUCTS_BATCH = 50;
const MAX_LINE_QTY = 99;

function emptyCart(): CartDTO {
  return {
    lines: [],
    count: 0,
    subtotalBaseCents: 0,
    removedCount: 0,
    removedNames: [],
    removedIds: [],
    outOfStockCount: 0,
  };
}

/**
 * Guest-cart display projection — the exact twin of the server's loadCart
 * (apps/web/lib/actions/cart.ts): deleted/hidden lines go to the removed
 * banner, zero-stock lines stay visible with qty 0, and stored qtys clamp
 * to live stock for display.
 */
export function guestLinesToCart(
  guest: GuestLine[],
  products: GuestCartProductDTO[],
): CartDTO {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: CartLineDTO[] = [];
  const removedNames: string[] = [];
  const removedIds: string[] = [];
  let outOfStockCount = 0;

  for (const item of guest) {
    const p = byId.get(item.productId);
    if (!p) {
      removedNames.push("Removed product");
      removedIds.push(item.productId);
      continue;
    }
    if (!p.active) {
      removedNames.push(p.name);
      removedIds.push(p.id);
      continue;
    }
    const qty = Math.max(1, item.qty);
    const clamped = qty > p.stock;
    const showQty = clamped ? Math.max(0, p.stock) : qty;
    if (p.stock <= 0) outOfStockCount += 1;
    lines.push({
      productId: p.id,
      slug: p.slug,
      name: p.name,
      image: p.images[0]?.url ?? null,
      unitBaseCents: p.priceBaseCents,
      qty: showQty,
      stock: p.stock,
      lineBaseCents: p.priceBaseCents * showQty,
      clamped,
    });
  }

  return {
    lines,
    count: lines.reduce((n, l) => n + l.qty, 0),
    subtotalBaseCents: lines.reduce((n, l) => n + l.lineBaseCents, 0),
    removedCount: removedIds.length,
    removedNames,
    removedIds,
    outOfStockCount,
  };
}

async function loadGuestCart(): Promise<CartDTO> {
  const guest = await getGuestLines();
  if (guest.length === 0) return emptyCart();

  const ids = [...new Set(guest.map((l) => l.productId))];
  const products: GuestCartProductDTO[] = [];
  for (let i = 0; i < ids.length; i += CART_PRODUCTS_BATCH) {
    products.push(
      ...(await getCartProducts(ids.slice(i, i + CART_PRODUCTS_BATCH))),
    );
  }
  return guestLinesToCart(guest, products);
}

async function guestSummary(): Promise<CartRemoveResultDTO> {
  const cart = await loadGuestCart();
  return { count: cart.count, subtotalBaseCents: cart.subtotalBaseCents };
}

type CartMutationVars =
  | { type: "add"; productId: string; qty: number }
  | { type: "update"; productId: string; qty: number }
  | { type: "remove"; productId: string }
  | { type: "clear" };

type CartMutationOutcome =
  | { kind: "add" | "update"; data: CartMutationResultDTO }
  | { kind: "remove" | "clear"; data: CartRemoveResultDTO };

async function runGuestMutation(
  vars: CartMutationVars,
): Promise<CartMutationOutcome> {
  switch (vars.type) {
    case "add": {
      // Mirror the server's guards so feedback is honest before the merge.
      const [product] = await getCartProducts([vars.productId]);
      if (!product || !product.active) {
        throw new ApiError(
          "NOT_FOUND",
          "That product is no longer available.",
          404,
        );
      }
      if (product.stock <= 0) {
        throw new ApiError(
          "OUT_OF_STOCK",
          `${product.name} is out of stock.`,
          409,
        );
      }
      const before =
        (await getGuestLines()).find((l) => l.productId === vars.productId)
          ?.qty ?? 0;
      await addGuestLine(vars.productId, vars.qty);
      const cart = await loadGuestCart();
      const line = cart.lines.find((l) => l.productId === vars.productId);
      const qty = line?.qty ?? 0;
      return {
        kind: "add",
        data: {
          qty,
          clamped: before + vars.qty > qty,
          count: cart.count,
          subtotalBaseCents: cart.subtotalBaseCents,
        },
      };
    }
    case "update": {
      const cart = await loadGuestCart();
      const line = cart.lines.find((l) => l.productId === vars.productId);
      if (!line) {
        throw new ApiError(
          "NOT_FOUND",
          "That item is not in your cart.",
          404,
        );
      }
      if (line.stock <= 0) {
        await removeGuestLine(vars.productId);
        throw new ApiError(
          "OUT_OF_STOCK",
          `${line.name} is out of stock and was removed.`,
          409,
        );
      }
      const qty = Math.min(vars.qty, line.stock, MAX_LINE_QTY);
      await updateGuestLine(vars.productId, qty);
      const next = await guestSummary();
      return {
        kind: "update",
        data: { qty, clamped: vars.qty > qty, ...next },
      };
    }
    case "remove": {
      await removeGuestLine(vars.productId);
      return { kind: "remove", data: await guestSummary() };
    }
    case "clear": {
      await clearGuestLines();
      return { kind: "clear", data: { count: 0, subtotalBaseCents: 0 } };
    }
  }
}

async function runServerMutation(
  vars: CartMutationVars,
  cart: CartDTO | undefined,
): Promise<CartMutationOutcome> {
  switch (vars.type) {
    case "add":
      return {
        kind: "add",
        data: await addCartItem({ productId: vars.productId, qty: vars.qty }),
      };
    case "update":
      return {
        kind: "update",
        data: await updateCartItem(vars.productId, vars.qty),
      };
    case "remove":
      return { kind: "remove", data: await removeCartItem(vars.productId) };
    case "clear": {
      // No bulk endpoint: remove every line the cart knows about, including
      // hidden/deleted ids surfaced by the removed banner.
      const ids = [
        ...(cart?.lines ?? []).map((l) => l.productId),
        ...(cart?.removedIds ?? []),
      ];
      for (const id of ids) {
        await removeCartItem(id);
      }
      const fresh = await getCart();
      return {
        kind: "clear",
        data: {
          count: fresh.count,
          subtotalBaseCents: fresh.subtotalBaseCents,
        },
      };
    }
  }
}

export type CartActions = {
  /** Add qty (default 1) to a line; server/guest stock clamps apply. */
  add: (productId: string, qty?: number) => Promise<CartMutationResultDTO>;
  update: (productId: string, qty: number) => Promise<CartMutationResultDTO>;
  remove: (productId: string) => Promise<CartRemoveResultDTO>;
  clear: () => Promise<void>;
};

export type UseCartResult = CartDTO &
  CartActions & {
    isGuest: boolean;
    /** Auth state is still unknown — neither guest nor signed-in yet. */
    isSessionPending: boolean;
    isLoading: boolean;
    isMutating: boolean;
    /** Product id of the line currently being mutated, if any. */
    pendingProductId: string | null;
    error: Error | null;
    refetch: () => void;
  };

/**
 * One cart for both worlds: signed-in reads/writes the server cart through
 * apiFetch; guests read/write the AsyncStorage store enriched with public
 * product snapshots. Every mutation invalidates `["cart"]` (and the auth
 * transition does too), so badges and screens stay in sync.
 */
export function useCart(): UseCartResult {
  const { data: session, isPending: sessionPending } = useSession();
  const queryClient = useQueryClient();

  const userId = session?.user?.id ?? null;
  const isGuest = !sessionPending && !userId;

  const query = useQuery({
    queryKey: CART_QUERY_KEY,
    enabled: !sessionPending,
    queryFn: async (): Promise<CartDTO> =>
      userId ? getCart() : loadGuestCart(),
  });

  const mutation = useMutation<
    CartMutationOutcome,
    Error,
    CartMutationVars
  >({
    mutationFn: (vars) => {
      // While the session probe is in flight, auth state is UNKNOWN: firing
      // the server path here would send a cookie-less request and bounce a
      // guest through a spurious 401. Refuse until the state resolves.
      if (sessionPending) {
        throw new ApiError(
          "AUTH_PENDING",
          "Checking your sign-in — try again in a moment.",
          0,
        );
      }
      return isGuest
        ? runGuestMutation(vars)
        : runServerMutation(vars, query.data);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY }),
    // Error paths may still have mutated server state (e.g. updateQty's
    // OUT_OF_STOCK removal), so refresh instead of leaving stale lines.
    onError: () =>
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY }),
  });

  const previousUserRef = useRef(userId);
  useEffect(() => {
    if (previousUserRef.current === userId) return;
    previousUserRef.current = userId;
    void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
  }, [userId, queryClient]);

  const data = query.data ?? emptyCart();

  return {
    ...data,
    isGuest,
    isSessionPending: sessionPending,
    isLoading: sessionPending || query.isPending,
    isMutating: mutation.isPending,
    pendingProductId:
      mutation.isPending &&
      mutation.variables &&
      mutation.variables.type !== "clear"
        ? mutation.variables.productId
        : null,
    error: (query.error as Error | null) ?? null,
    refetch: () => {
      void query.refetch();
    },
    add: async (productId, qty = 1) => {
      const out = await mutation.mutateAsync({ type: "add", productId, qty });
      return out.data as CartMutationResultDTO;
    },
    update: async (productId, qty) => {
      const out = await mutation.mutateAsync({ type: "update", productId, qty });
      return out.data as CartMutationResultDTO;
    },
    remove: async (productId) => {
      const out = await mutation.mutateAsync({ type: "remove", productId });
      return out.data as CartRemoveResultDTO;
    },
    clear: async () => {
      await mutation.mutateAsync({ type: "clear" });
    },
  };
}

/**
 * Merge-on-sign-in, mounted once in the root layout. When a session appears
 * and guest lines exist, the device cart is summed into the DB cart
 * (clamped server-side), the guest store is cleared, and `["cart"]` is
 * invalidated. A per-user guard marks only after a non-empty attempt and
 * resets on sign-out or failure, so an empty first login never blocks a
 * later merge and no retry loop can form.
 */
export function CartSync() {
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();
  const mergedFor = useRef<string | null>(null);

  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (isPending) return;
    if (!userId) {
      mergedFor.current = null;
      return;
    }
    if (mergedFor.current === userId) return;

    let cancelled = false;
    void (async () => {
      const guest = await getGuestLines();
      // Empty guest: don't mark — a later login with items must still merge.
      if (guest.length === 0) return;
      mergedFor.current = userId;
      try {
        await mergeCart(guest.map((l) => ({ productId: l.productId, qty: l.qty })));
        await clearGuestLines();
        await queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      } catch {
        if (!cancelled) mergedFor.current = null; // keep the guest cart for retry
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, isPending, queryClient]);

  return null;
}

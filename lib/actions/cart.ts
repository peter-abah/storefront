"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  cartItems,
  carts,
  currencies,
  products,
} from "@/lib/db/schema";
import { getSessionProfile } from "@/lib/auth-session";
import { cartLineSchema } from "@/lib/validations";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

export type CartLineDTO = {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  unitBaseCents: number;
  qty: number;
  stock: number;
  lineBaseCents: number;
  /** True when the stored qty exceeds live stock (display clamps). */
  clamped: boolean;
};

export type CartDTO = {
  lines: CartLineDTO[];
  count: number;
  subtotalBaseCents: number;
};

const EMPTY: CartDTO = { lines: [], count: 0, subtotalBaseCents: 0 };

async function cartIdFor(userId: string): Promise<string | null> {
  const row = (
    await db.select().from(carts).where(eq(carts.userId, userId)).limit(1)
  )[0];
  return row?.id ?? null;
}

async function ensureCartId(userId: string): Promise<string> {
  const found = await cartIdFor(userId);
  if (found) return found;
  await db.insert(carts).values({ userId }).onConflictDoNothing();
  const row = (
    await db.select().from(carts).where(eq(carts.userId, userId)).limit(1)
  )[0];
  if (!row) throw new Error("Could not create cart.");
  return row.id;
}

/** Live DB read: cart lines joined to ACTIVE products only. Display clamps. */
async function loadCart(userId: string): Promise<CartDTO> {
  const cartId = await cartIdFor(userId);
  if (!cartId) return EMPTY;

  const items = await db
    .select()
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));
  if (items.length === 0) return EMPTY;

  const prods = await db
    .select()
    .from(products)
    .where(
      inArray(
        products.id,
        items.map((i) => i.productId),
      ),
    );
  const byId = new Map(prods.filter((p) => p.active).map((p) => [p.id, p]));

  const lines: CartLineDTO[] = [];
  for (const item of items) {
    const p = byId.get(item.productId);
    if (!p) continue; // inactive or deleted product — hidden from display
    const qty = Math.max(1, item.qty);
    const clamped = qty > p.stock;
    const showQty = clamped ? Math.max(0, p.stock) : qty;
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
  };
}

async function summarize(userId: string) {
  const cart = await loadCart(userId);
  return { count: cart.count, subtotalBaseCents: cart.subtotalBaseCents };
}

export async function getCart(): Promise<ActionResult<CartDTO>> {
  const sp = await getSessionProfile();
  if (!sp) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Sign in to see your cart." };
  }
  return { ok: true, data: await loadCart(sp.user.id) };
}

export async function addToCart(
  input: unknown,
): Promise<ActionResult<{ qty: number; clamped: boolean; count: number; subtotalBaseCents: number }>> {
  const parsed = cartLineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: "Invalid product or quantity." };
  }
  const sp = await getSessionProfile();
  if (!sp) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Sign in to add to your cart." };
  }

  const product = (
    await db.select().from(products).where(eq(products.id, parsed.data.productId)).limit(1)
  )[0];
  if (!product || !product.active) {
    return { ok: false, code: "NOT_FOUND", message: "That product is no longer available." };
  }
  if (product.stock <= 0) {
    return { ok: false, code: "OUT_OF_STOCK", message: `${product.name} is out of stock.` };
  }

  const cartId = await ensureCartId(sp.user.id);
  const existing = (
    await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cartId),
          eq(cartItems.productId, product.id),
        ),
      )
      .limit(1)
  )[0];

  const wanted = (existing?.qty ?? 0) + parsed.data.qty;
  const qty = Math.min(wanted, product.stock, 99);
  const clamped = wanted > qty;

  if (existing) {
    await db
      .update(cartItems)
      .set({ qty })
      .where(
        and(eq(cartItems.cartId, cartId), eq(cartItems.productId, product.id)),
      );
  } else {
    await db.insert(cartItems).values({ cartId, productId: product.id, qty });
  }

  return { ok: true, data: { qty, clamped, ...(await summarize(sp.user.id)) } };
}

export async function updateQty(
  input: unknown,
): Promise<ActionResult<{ qty: number; clamped: boolean; count: number; subtotalBaseCents: number }>> {
  const parsed = cartLineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: "Quantity must be 1–99." };
  }
  const sp = await getSessionProfile();
  if (!sp) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Sign in to edit your cart." };
  }

  const product = (
    await db.select().from(products).where(eq(products.id, parsed.data.productId)).limit(1)
  )[0];
  if (!product || !product.active) {
    return { ok: false, code: "NOT_FOUND", message: "That product is no longer available." };
  }

  const cartId = await cartIdFor(sp.user.id);
  if (!cartId) {
    return { ok: false, code: "NOT_FOUND", message: "That item is not in your cart." };
  }

  if (product.stock <= 0) {
    await db
      .delete(cartItems)
      .where(
        and(eq(cartItems.cartId, cartId), eq(cartItems.productId, product.id)),
      );
    return { ok: false, code: "OUT_OF_STOCK", message: `${product.name} is out of stock and was removed.` };
  }

  const qty = Math.min(parsed.data.qty, product.stock, 99);
  const clamped = parsed.data.qty > qty;

  await db
    .update(cartItems)
    .set({ qty })
    .where(
      and(eq(cartItems.cartId, cartId), eq(cartItems.productId, product.id)),
    );

  return { ok: true, data: { qty, clamped, ...(await summarize(sp.user.id)) } };
}

export async function removeLine(
  productId: unknown,
): Promise<ActionResult<{ count: number; subtotalBaseCents: number }>> {
  const parsed = z.string().uuid().safeParse(productId);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: "Invalid product." };
  }
  const sp = await getSessionProfile();
  if (!sp) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Sign in to edit your cart." };
  }
  const cartId = await cartIdFor(sp.user.id);
  if (cartId) {
    await db
      .delete(cartItems)
      .where(
        and(eq(cartItems.cartId, cartId), eq(cartItems.productId, parsed.data)),
      );
  }
  return { ok: true, data: await summarize(sp.user.id) };
}

export async function mergeGuestCart(
  lines: unknown,
): Promise<ActionResult<{ merged: number; skipped: number; count: number; subtotalBaseCents: number }>> {
  const parsed = z.array(cartLineSchema).max(100).safeParse(lines);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: "Invalid guest cart." };
  }
  const sp = await getSessionProfile();
  if (!sp) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Sign in to merge your cart." };
  }
  if (parsed.data.length === 0) {
    return { ok: true, data: { merged: 0, skipped: 0, ...(await summarize(sp.user.id)) } };
  }

  const cartId = await ensureCartId(sp.user.id);
  let merged = 0;
  let skipped = 0;

  for (const line of parsed.data) {
    const product = (
      await db.select().from(products).where(eq(products.id, line.productId)).limit(1)
    )[0];
    if (!product || !product.active || product.stock <= 0) {
      skipped += 1;
      continue;
    }
    const existing = (
      await db
        .select()
        .from(cartItems)
        .where(
          and(eq(cartItems.cartId, cartId), eq(cartItems.productId, product.id)),
        )
        .limit(1)
    )[0];
    const qty = Math.min((existing?.qty ?? 0) + line.qty, product.stock, 99);
    if (existing) {
      await db
        .update(cartItems)
        .set({ qty })
        .where(
          and(eq(cartItems.cartId, cartId), eq(cartItems.productId, product.id)),
        );
    } else {
      await db.insert(cartItems).values({ cartId, productId: product.id, qty });
    }
    merged += 1;
  }

  return { ok: true, data: { merged, skipped, ...(await summarize(sp.user.id)) } };
}

/** Public (no auth): active product snapshots for guest-cart display. */
export async function getCartProducts(ids: unknown) {
  const parsed = z.array(z.string().uuid()).max(50).safeParse(ids);
  if (!parsed.success || parsed.data.length === 0) {
    return { ok: true as const, data: [] as const };
  }
  const unique = [...new Set(parsed.data)];
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      priceBaseCents: products.priceBaseCents,
      stock: products.stock,
      images: products.images,
    })
    .from(products)
    .where(inArray(products.id, unique));
  return { ok: true as const, data: rows.filter((r) => r.stock >= 0) };
}

/** Public (no auth): currencies the shopper may price in. */
export async function getActiveCurrencies() {
  const rows = await db.select().from(currencies).where(eq(currencies.active, true));
  return { ok: true as const, data: rows };
}

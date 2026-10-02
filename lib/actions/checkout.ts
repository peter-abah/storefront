"use server";

import { headers } from "next/headers";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  cartItems,
  carts,
  currencies,
  emailLog,
  orderItems,
  orders,
  products,
  shippingRates,
  shippingZones,
} from "@/lib/db/schema";
import { getSessionProfile } from "@/lib/auth-session";
import { checkoutSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "./cart";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function genOrderNumber(): string {
  let s = "";
  for (let i = 0; i < 5; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `MS-${s}`;
}

function firstAdminEmail(): string | null {
  const first = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return first ?? null;
}

/**
 * COD createOrder — server re-prices EVERY line from the DB and re-checks
 * stock; client totals are never trusted (the client sends none).
 * Sequential statements only — NEVER db.transaction (neon-http forbids it).
 * After cart clear: fire-and-forget notify fetch (Wave 5 queue → worker).
 */
export async function createOrder(
  input: unknown,
): Promise<ActionResult<{ orderId: string; number: string; idempotent?: boolean }>> {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`createOrder:${ip}`)) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many orders — wait a minute and try again.",
    };
  }

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }
  const { address, currencyCode, clientToken } = parsed.data;
  // Top-level zoneId is authoritative; address.zoneId must agree.
  const zoneId = parsed.data.zoneId;

  const sp = await getSessionProfile();
  if (!sp) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Sign in to place your order." };
  }

  // Idempotency: double-submit with the same token returns the first order.
  const prior = (
    await db.select().from(orders).where(eq(orders.clientToken, clientToken)).limit(1)
  )[0];
  if (prior) {
    return { ok: true, data: { orderId: prior.id, number: prior.number, idempotent: true } };
  }

  // Load cart RAW (stored qty, not display-clamped) + live products.
  const cart = (
    await db.select().from(carts).where(eq(carts.userId, sp.user.id)).limit(1)
  )[0];
  const stored = cart
    ? await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id))
    : [];
  if (stored.length === 0) {
    return { ok: false, code: "EMPTY_CART", message: "Your cart is empty." };
  }

  const priced: { productId: string; name: string; qty: number; unit: number }[] = [];
  for (const item of stored) {
    const p = (
      await db.select().from(products).where(eq(products.id, item.productId)).limit(1)
    )[0];
    if (!p || !p.active) {
      return { ok: false, code: "NOT_FOUND", message: "A product in your cart is no longer available." };
    }
    if (item.qty > p.stock) {
      return {
        ok: false,
        code: "OUT_OF_STOCK",
        message:
          p.stock <= 0
            ? `${p.name} just sold out — remove it to continue.`
            : `Only ${p.stock} × ${p.name} left — lower the quantity to continue.`,
      };
    }
    priced.push({ productId: p.id, name: p.name, qty: item.qty, unit: p.priceBaseCents });
  }

  const subtotal = priced.reduce((n, l) => n + l.unit * l.qty, 0);

  // Zone fee: rate with the largest min_subtotal at or below the subtotal
  // ("free over X" = fee_cents 0 row). Below the smallest tier, use that tier.
  const zone = (
    await db.select().from(shippingZones).where(eq(shippingZones.id, zoneId)).limit(1)
  )[0];
  if (!zone || !zone.active) {
    return { ok: false, code: "INVALID_ZONE", message: "Choose a valid delivery zone." };
  }
  const tier =
    (
      await db
        .select()
        .from(shippingRates)
        .where(
          and(
            eq(shippingRates.zoneId, zoneId),
            lte(shippingRates.minSubtotalCents, subtotal),
          ),
        )
        .orderBy(desc(shippingRates.minSubtotalCents))
        .limit(1)
    )[0] ??
    (
      await db
        .select()
        .from(shippingRates)
        .where(eq(shippingRates.zoneId, zoneId))
        .orderBy(shippingRates.minSubtotalCents)
        .limit(1)
    )[0];
  if (!tier) {
    return { ok: false, code: "INVALID_ZONE", message: "No delivery rates for this zone yet." };
  }
  const shipping = tier.feeCents;

  const currency = (
    await db.select().from(currencies).where(eq(currencies.code, currencyCode)).limit(1)
  )[0];
  if (!currency || !currency.active || !(Number(currency.rateToBase) > 0)) {
    return { ok: false, code: "INVALID_CURRENCY", message: "Choose a valid currency." };
  }

  const total = subtotal + shipping;
  const snapshotAddress = { ...address, zoneId };

  // Insert order with retry-on-conflict order number (×3).
  let orderId: string | null = null;
  let orderNumber: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const number = genOrderNumber();
    try {
      const inserted = await db
        .insert(orders)
        .values({
          number,
          userId: sp.user.id,
          email: sp.user.email,
          status: "pending",
          currencyCode: currency.code,
          fxRateSnapshot: currency.rateToBase,
          subtotalBaseCents: subtotal,
          shippingBaseCents: shipping,
          totalBaseCents: total,
          address: snapshotAddress,
          clientToken,
        })
        .returning();
      orderId = inserted[0]?.id ?? null;
      orderNumber = inserted[0]?.number ?? null;
      if (orderId) break;
    } catch {
      // Concurrent double-submit won the token race — return the winner.
      const winner = (
        await db.select().from(orders).where(eq(orders.clientToken, clientToken)).limit(1)
      )[0];
      if (winner) {
        return { ok: true, data: { orderId: winner.id, number: winner.number, idempotent: true } };
      }
      if (attempt === 2) {
        return { ok: false, code: "ORDER_FAILED", message: "Could not place the order — try again." };
      }
    }
  }
  if (!orderId || !orderNumber) {
    return { ok: false, code: "ORDER_FAILED", message: "Could not place the order — try again." };
  }

  await db.insert(orderItems).values(
    priced.map((l) => ({
      orderId: orderId as string,
      productId: l.productId,
      qty: l.qty,
      unitBaseCents: l.unit,
    })),
  );

  // Wave 5 queue: 3 pending rows; the notify worker sends them.
  const adminEmail = firstAdminEmail();
  const ownerEmail = process.env.OWNER_EMAIL?.trim() || adminEmail || sp.user.email;
  await db.insert(emailLog).values([
    { orderId, kind: "buyer_confirm", toEmail: sp.user.email },
    { orderId, kind: "owner_fulfill", toEmail: ownerEmail },
    { orderId, kind: "admin_digest", toEmail: adminEmail || ownerEmail },
  ]);

  // Atomic per-line decrement; a 0-row hit means someone bought the last
  // unit between our check and now → restock lines already decremented,
  // cancel this order (items/email rows stay as history), buyer retries.
  const decremented: typeof priced = [];
  for (const l of priced) {
    const res = (await db.execute(
      sql`UPDATE products SET stock = stock - ${l.qty} WHERE id = ${l.productId} AND stock >= ${l.qty} RETURNING id`,
    )) as unknown as unknown[];
    if (res.length === 0) {
      for (const d of decremented) {
        await db.execute(
          sql`UPDATE products SET stock = stock + ${d.qty} WHERE id = ${d.productId}`,
        );
      }
      await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId));
      return {
        ok: false,
        code: "OUT_OF_STOCK",
        message: `${l.name} just sold out — your order was cancelled, nothing was charged.`,
      };
    }
    decremented.push(l);
  }

  if (cart) {
    await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
  }

  // Wave 5: fire-and-forget notify worker. 2s abort, errors swallowed —
  // log rows stay pending for retry. Skip when APP_URL unset (dev without
  // server): rows stay pending for the worker/cron.
  try {
    const appUrl = (process.env.APP_URL ?? "").trim();
    const secret = process.env.NOTIFY_SECRET ?? "";
    if (appUrl && secret) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      void fetch(`${appUrl.replace(/\/$/, "")}/api/orders/notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ orderId }),
        signal: controller.signal,
      })
        .catch(() => {})
        .finally(() => clearTimeout(timer));
    }
  } catch {
    // Swallowed — pending rows are the retry queue.
  }

  return { ok: true, data: { orderId, number: orderNumber } };
}

"use server";

import { headers } from "next/headers";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { z } from "zod";
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
import {
  PaystackError,
  baseCentsToKobo,
  genPaystackRef,
  paystackPublicKey,
  paystackSecret,
  verifyPaystackTransaction,
} from "@/lib/paystack";
import { finalizePaidOrder, isMethodEnabled } from "@/lib/payments";
import { firstAdminDbEmail } from "@/lib/admin-emails";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function genOrderNumber(): string {
  let s = "";
  for (let i = 0; i < 5; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `MS-${s}`;
}

async function firstAdminEmail(): Promise<string | null> {
  const first = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return first || (await firstAdminDbEmail()) || null;
}

export type CheckoutPriceSnapshot = {
  subtotalBaseCents: number;
  shippingBaseCents: number;
  totalBaseCents: number;
  currencyCode: string;
  rateToBase: string;
};

export type PriceChangedFailure = {
  ok: false;
  code: "PRICE_CHANGED";
  message: string;
  old: CheckoutPriceSnapshot;
  new: CheckoutPriceSnapshot;
};

export type CreateOrderResult =
  | ActionResult<{ orderId: string; number: string; idempotent?: boolean }>
  | PriceChangedFailure;

type PricedLine = { productId: string; name: string; qty: number; unit: number };

type Repriced =
  | {
      kind: "ok";
      priced: PricedLine[];
      subtotal: number;
      shipping: number;
      total: number;
      currency: typeof currencies.$inferSelect;
      zoneId: string;
    }
  | { kind: "error"; code: string; message: string }
  | { kind: "drift"; old: CheckoutPriceSnapshot; new: CheckoutPriceSnapshot };

/**
 * Shared re-price: loads the cart RAW + live products, re-checks stock,
 * resolves the zone tier and currency, then compares the shopper-reviewed
 * expected* snapshot (never trusted for charging). Used by BOTH the COD
 * path and Paystack init so the honest-price guarantee is identical.
 */
async function repriceForCheckout(
  userId: string,
  parsed: {
    currencyCode: string;
    zoneId: string;
    expectedSubtotalBaseCents?: number;
    expectedShippingBaseCents?: number;
    expectedTotalBaseCents?: number;
    expectedRateToBase?: string;
  },
): Promise<Repriced> {
  const { currencyCode, zoneId } = parsed;

  const cart = (
    await db.select().from(carts).where(eq(carts.userId, userId)).limit(1)
  )[0];
  const stored = cart
    ? await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id))
    : [];
  if (stored.length === 0) {
    return { kind: "error", code: "EMPTY_CART", message: "Your cart is empty." };
  }

  const priced: PricedLine[] = [];
  for (const item of stored) {
    const p = (
      await db.select().from(products).where(eq(products.id, item.productId)).limit(1)
    )[0];
    if (!p || !p.active) {
      return {
        kind: "error",
        code: "NOT_FOUND",
        message: "A product in your cart is no longer available.",
      };
    }
    if (item.qty > p.stock) {
      return {
        kind: "error",
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
    return { kind: "error", code: "INVALID_ZONE", message: "Choose a valid delivery zone." };
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
    return { kind: "error", code: "INVALID_ZONE", message: "No delivery rates for this zone yet." };
  }
  const shipping = tier.feeCents;

  const currency = (
    await db.select().from(currencies).where(eq(currencies.code, currencyCode)).limit(1)
  )[0];
  if (!currency || !currency.active || !(Number(currency.rateToBase) > 0)) {
    return { kind: "error", code: "INVALID_CURRENCY", message: "Choose a valid currency." };
  }

  const total = subtotal + shipping;

  const expSub = parsed.expectedSubtotalBaseCents;
  const expShip = parsed.expectedShippingBaseCents;
  const expTotal = parsed.expectedTotalBaseCents;
  const expRate = parsed.expectedRateToBase;
  if (
    expSub !== undefined ||
    expShip !== undefined ||
    expTotal !== undefined ||
    expRate !== undefined
  ) {
    const serverRateNum = Number(currency.rateToBase);
    const expRateNum = expRate !== undefined ? Number(expRate) : NaN;
    let rateDrift = false;
    if (expRate !== undefined) {
      if (Number.isFinite(serverRateNum) && Number.isFinite(expRateNum)) {
        rateDrift = expRateNum !== serverRateNum;
      } else {
        rateDrift = expRate.trim() !== String(currency.rateToBase).trim();
      }
    }
    const drifted =
      (expSub !== undefined && expSub !== subtotal) ||
      (expShip !== undefined && expShip !== shipping) ||
      (expTotal !== undefined && expTotal !== total) ||
      rateDrift;
    if (drifted) {
      return {
        kind: "drift",
        old: {
          subtotalBaseCents: expSub ?? subtotal,
          shippingBaseCents: expShip ?? shipping,
          totalBaseCents: expTotal ?? total,
          currencyCode,
          rateToBase: expRate ?? String(currency.rateToBase),
        },
        new: {
          subtotalBaseCents: subtotal,
          shippingBaseCents: shipping,
          totalBaseCents: total,
          currencyCode: currency.code,
          rateToBase: String(currency.rateToBase),
        },
      };
    }
  }

  return { kind: "ok", priced, subtotal, shipping, total, currency, zoneId };
}

function driftFailure(d: Extract<Repriced, { kind: "drift" }>): PriceChangedFailure {
  return {
    ok: false,
    code: "PRICE_CHANGED",
    message: "Prices changed since you reviewed — confirm the new total to continue.",
    old: d.old,
    new: d.new,
  };
}

/**
 * COD createOrder — server re-prices EVERY line from the DB and re-checks
 * stock; client totals are never trusted (expected* fields are only the
 * shopper-reviewed snapshot used for PRICE_CHANGED detection, never for
 * charging). Sequential statements only — NEVER db.transaction
 * (neon-http forbids it). After cart clear: fire-and-forget notify fetch
 * (Wave 5 queue → worker).
 */
export async function createOrder(input: unknown): Promise<CreateOrderResult> {
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
  if (parsed.data.paymentMethod !== "cod") {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "That payment choice needs the online flow — pick cash on delivery here.",
    };
  }
  const { address, clientToken } = parsed.data;
  // Top-level zoneId is authoritative; address.zoneId must agree.
  const zoneId = parsed.data.zoneId;

  const sp = await getSessionProfile();
  if (!sp) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Sign in to place your order." };
  }

  // Idempotency scoped by (clientToken, paymentMethod): a token minted
  // for one method never satisfies the other. Cross-method reuse is
  // rejected so the client mints a fresh token and retries.
  const prior = (
    await db.select().from(orders).where(eq(orders.clientToken, clientToken)).limit(1)
  )[0];
  if (prior) {
    if (prior.paymentMethod !== "cod") {
      return {
        ok: false,
        code: "PAYMENT_METHOD_MISMATCH",
        message: "This checkout was started with a different payment method — try again with a fresh checkout.",
      };
    }
    return { ok: true, data: { orderId: prior.id, number: prior.number, idempotent: true } };
  }

  const repriced = await repriceForCheckout(sp.user.id, parsed.data);
  if (repriced.kind === "error") {
    return { ok: false, code: repriced.code, message: repriced.message };
  }
  if (repriced.kind === "drift") {
    return driftFailure(repriced);
  }
  const { priced, subtotal, shipping, total, currency } = repriced;

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
          paymentMethod: "cod",
          paymentStatus: "unpaid",
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
      // Concurrent double-submit won the token race — return the winner,
      // unless it belongs to the other payment method.
      const winner = (
        await db.select().from(orders).where(eq(orders.clientToken, clientToken)).limit(1)
      )[0];
      if (winner) {
        if (winner.paymentMethod !== "cod") {
          return {
            ok: false,
            code: "PAYMENT_METHOD_MISMATCH",
            message: "This checkout was started with a different payment method — try again with a fresh checkout.",
          };
        }
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
  const adminEmail = await firstAdminEmail();
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

  const cart = (
    await db.select().from(carts).where(eq(carts.userId, sp.user.id)).limit(1)
  )[0];
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

export type InitPaystackResult =
  | ActionResult<{
      orderId: string;
      number: string;
      reference: string;
      /** Integer kobo to charge (base cents 1:1 while base is NGN). */
      kobo: number;
      email: string;
      publicKey: string;
      paid?: boolean;
      idempotent?: boolean;
    }>
  | PriceChangedFailure;

/**
 * Paystack init — same honest re-price as COD, but creates the order in
 * `awaiting_payment` WITHOUT decrementing stock, clearing the cart, or
 * queueing mails. Those happen only in verify/webhook after the gateway
 * confirms money (frozen fx snapshot + integer kobo, never a live rate).
 */
export async function initPaystackOrder(input: unknown): Promise<InitPaystackResult> {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`initPaystack:${ip}`)) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many payment attempts — wait a minute and try again.",
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
  if (parsed.data.paymentMethod !== "paystack") {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Choose Paystack to pay online, or place a cash-on-delivery order instead.",
    };
  }
  const { address, clientToken } = parsed.data;
  const zoneId = parsed.data.zoneId;

  const sp = await getSessionProfile();
  if (!sp) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Sign in to pay for your order." };
  }

  if (!(await isMethodEnabled("paystack"))) {
    return {
      ok: false,
      code: "PAYSTACK_DISABLED",
      message: "Online payment is currently off — choose cash on delivery instead.",
    };
  }

  // Idempotency scoped by (clientToken, paymentMethod): a retry returns
  // the pending order (with a fresh kobo quote from the frozen totals);
  // an already-paid token routes straight to the order page without a
  // second popup. A COD token never satisfies a Paystack init and vice
  // versa — cross-method reuse is rejected so the client mints fresh.
  const prior = (
    await db.select().from(orders).where(eq(orders.clientToken, clientToken)).limit(1)
  )[0];
  if (prior) {
    if (prior.paymentMethod !== "paystack") {
      return {
        ok: false,
        code: "PAYMENT_METHOD_MISMATCH",
        message: "This checkout was started with a different payment method — try again with a fresh checkout.",
      };
    }
    if (prior.status === "paid_online") {
      return {
        ok: true,
        data: {
          orderId: prior.id,
          number: prior.number,
          reference: prior.paystackRef ?? "",
          kobo: prior.totalBaseCents,
          email: sp.user.email,
          publicKey: paystackPublicKey(),
          paid: true,
          idempotent: true,
        },
      };
    }
    if (prior.status === "awaiting_payment" || prior.status === "failed") {
      return {
        ok: true,
        data: {
          orderId: prior.id,
          number: prior.number,
          reference: prior.paystackRef ?? "",
          kobo: prior.totalBaseCents,
          email: sp.user.email,
          publicKey: paystackPublicKey(),
          idempotent: true,
        },
      };
    }
    return {
      ok: true,
      data: {
        orderId: prior.id,
        number: prior.number,
        reference: prior.paystackRef ?? "",
        kobo: prior.totalBaseCents,
        email: sp.user.email,
        publicKey: paystackPublicKey(),
        paid: prior.status === "paid_online",
        idempotent: true,
      },
    };
  }

  const repriced = await repriceForCheckout(sp.user.id, parsed.data);
  if (repriced.kind === "error") {
    return { ok: false, code: repriced.code, message: repriced.message };
  }
  if (repriced.kind === "drift") {
    return driftFailure(repriced);
  }
  const { priced, subtotal, shipping, total, currency } = repriced;
  const snapshotAddress = { ...address, zoneId };

  let orderId: string | null = null;
  let orderNumber: string | null = null;
  let reference: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const number = genOrderNumber();
    const ref = genPaystackRef(number);
    try {
      const inserted = await db
        .insert(orders)
        .values({
          number,
          userId: sp.user.id,
          email: sp.user.email,
          status: "awaiting_payment",
          paymentMethod: "paystack",
          paymentStatus: "awaiting",
          paystackRef: ref,
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
      reference = inserted[0]?.paystackRef ?? ref;
      if (orderId) break;
    } catch {
      const winner = (
        await db.select().from(orders).where(eq(orders.clientToken, clientToken)).limit(1)
      )[0];
      if (winner) {
        if (winner.paymentMethod !== "paystack") {
          return {
            ok: false,
            code: "PAYMENT_METHOD_MISMATCH",
            message: "This checkout was started with a different payment method — try again with a fresh checkout.",
          };
        }
        return {
          ok: true,
          data: {
            orderId: winner.id,
            number: winner.number,
            reference: winner.paystackRef ?? "",
            kobo: winner.totalBaseCents,
            email: sp.user.email,
            publicKey: paystackPublicKey(),
            paid: winner.status === "paid_online",
            idempotent: true,
          },
        };
      }
      if (attempt === 2) {
        return { ok: false, code: "ORDER_FAILED", message: "Could not start the payment — try again." };
      }
    }
  }
  if (!orderId || !orderNumber || !reference) {
    return { ok: false, code: "ORDER_FAILED", message: "Could not start the payment — try again." };
  }

  await db.insert(orderItems).values(
    priced.map((l) => ({
      orderId: orderId as string,
      productId: l.productId,
      qty: l.qty,
      unitBaseCents: l.unit,
    })),
  );

  // Deliberately NO stock decrement, NO cart clear, NO mails here — the
  // order holds nothing until verify/webhook confirms gateway money.
  let kobo: number;
  try {
    kobo = baseCentsToKobo(total);
  } catch {
    return { ok: false, code: "ORDER_FAILED", message: "This total cannot be charged online — choose cash on delivery." };
  }
  return {
    ok: true,
    data: {
      orderId,
      number: orderNumber,
      reference,
      kobo,
      email: sp.user.email,
      publicKey: paystackPublicKey(),
    },
  };
}

const verifyInputSchema = z.object({
  orderId: z.string().uuid("Invalid order."),
  reference: z
    .string()
    .trim()
    .min(1, "Missing payment reference.")
    .max(100, "Invalid payment reference.")
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid payment reference."),
});

export type VerifyPaystackResult = ActionResult<{
  orderId: string;
  number: string;
  idempotent?: boolean;
}>;

/**
 * Paystack verify — called after the inline popup (or a retry). Confirms
 * money server-side with the secret key, checks the integer kobo against
 * the frozen order total, then runs the atomic-conditional finalize
 * (decrement, clear cart, queue mails). Idempotent by reference.
 */
export async function verifyPaystackOrder(input: unknown): Promise<VerifyPaystackResult> {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`verifyPaystack:${ip}`)) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many verification attempts — wait a moment and try again.",
    };
  }

  const parsed = verifyInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: parsed.error.issues[0]?.message ?? "Check the payment details and try again.",
    };
  }
  const { orderId, reference } = parsed.data;

  const sp = await getSessionProfile();
  if (!sp) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Sign in to confirm your payment." };
  }

  const order = (
    await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  )[0];
  if (!order || order.userId !== sp.user.id) {
    return { ok: false, code: "NOT_FOUND", message: "Order not found." };
  }
  if (order.paymentMethod !== "paystack") {
    return { ok: false, code: "INVALID_INPUT", message: "This order is cash on delivery — no online payment to confirm." };
  }
  if (order.status === "paid_online" && order.paystackRef === reference) {
    return { ok: true, data: { orderId: order.id, number: order.number, idempotent: true } };
  }
  if (order.status === "paid_online") {
    return { ok: true, data: { orderId: order.id, number: order.number, idempotent: true } };
  }
  if (order.status !== "awaiting_payment" && order.status !== "failed") {
    return {
      ok: false,
      code: "INVALID_STATE",
      message: `This order is ${order.status} — contact the shop so we can reconcile payment ${reference}.`,
    };
  }
  if (order.paymentStatus === "paid") {
    return {
      ok: false,
      code: "INVALID_STATE",
      message: "Payment is already recorded on this order — contact the shop for help.",
    };
  }

  let gateway;
  try {
    gateway = await verifyPaystackTransaction(reference, paystackSecret());
  } catch (e) {
    const code = e instanceof PaystackError ? e.code : "GATEWAY_ERROR";
    return { ok: false, code, message: (e as Error)?.message ?? "Could not confirm the payment — try again." };
  }

  if (gateway.status !== "success") {
    // Definitive gateway failure — mark failed so the shopper can retry
    // with a fresh popup; nothing was captured.
    await db
      .update(orders)
      .set({ status: "failed", paymentStatus: "failed" })
      .where(eq(orders.id, order.id));
    return {
      ok: false,
      code: "PAYMENT_FAILED",
      message: "The payment did not go through — no money left your account. Try again.",
    };
  }

  if (!Number.isInteger(gateway.amountKobo) || gateway.amountKobo !== order.totalBaseCents) {
    // Gateway success but wrong amount — money may have moved; park as
    // failed/paid for ops to refund, never silently fulfill.
    await db
      .update(orders)
      .set({ status: "failed", paymentStatus: "paid", paystackRef: gateway.reference })
      .where(eq(orders.id, order.id));
    return {
      ok: false,
      code: "AMOUNT_MISMATCH",
      message: `Paid ${gateway.amountKobo} kobo but the order totals ${order.totalBaseCents} — the shop will reconcile or refund payment ${gateway.reference}. Contact us if you hear nothing within 24 hours.`,
    };
  }

  const finalized = await finalizePaidOrder(order.id, {
    reference: gateway.reference,
    amountKobo: gateway.amountKobo,
    channel: gateway.channel,
    last4: gateway.last4,
    brand: gateway.brand,
    paidAt: gateway.paidAt ? new Date(gateway.paidAt) : new Date(),
  });
  if (!finalized.ok) {
    return { ok: false, code: finalized.code, message: finalized.message };
  }
  return { ok: true, data: { orderId: finalized.orderId, number: finalized.number } };
}

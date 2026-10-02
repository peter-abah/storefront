// Shared payment persistence — used by the Paystack server actions AND the
// webhook route (which has no session). No "use server" here so route
// handlers can import it. Sequential statements only — NEVER db.transaction
// (neon-http forbids it).

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cartItems, carts, emailLog, orderItems, orders, paymentMethods, products } from "@/lib/db/schema";

export type PaymentMethodRow = { code: string; label: string; enabled: boolean };

const FALLBACK_METHODS: PaymentMethodRow[] = [
  { code: "cod", label: "Cash on Delivery", enabled: true },
];

/**
 * Live payment methods, defensive: when the table/cols are missing (DB not
 * yet migrated) checkout still builds and falls back to COD-only instead of
 * crashing the page.
 */
export async function getPaymentMethodsSafe(): Promise<PaymentMethodRow[]> {
  try {
    const rows = await db.select().from(paymentMethods);
    if (rows.length === 0) return FALLBACK_METHODS;
    return rows.map((r) => ({
      code: r.code,
      label: r.label,
      enabled: r.enabled,
    }));
  } catch {
    return FALLBACK_METHODS;
  }
}

export async function isMethodEnabled(code: string): Promise<boolean> {
  const methods = await getPaymentMethodsSafe();
  const row = methods.find((m) => m.code === code);
  // Unknown table content (fallback) → COD on, Paystack off.
  if (!row) return code === "cod";
  return row.enabled;
}

function firstAdminEmail(): string | null {
  const first = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return first ?? null;
}

function fireNotify(orderId: string): void {
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
}

/** Queue the 3 notify rows idempotently (webhook + verify can race). */
export async function queueOrderEmails(orderId: string, buyerEmail: string): Promise<void> {
  const adminEmail = firstAdminEmail();
  const ownerEmail = process.env.OWNER_EMAIL?.trim() || adminEmail || buyerEmail;
  await db
    .insert(emailLog)
    .values([
      { orderId, kind: "buyer_confirm", toEmail: buyerEmail },
      { orderId, kind: "owner_fulfill", toEmail: ownerEmail },
      { orderId, kind: "admin_digest", toEmail: adminEmail || ownerEmail },
    ])
    .onConflictDoNothing();
}

export type PaidFinalizeInput = {
  reference: string;
  amountKobo: number;
  channel?: string;
  last4?: string;
  brand?: string;
  paidAt?: Date;
};

export type FinalizeResult =
  | { ok: true; orderId: string; number: string }
  | { ok: false; code: "OUT_OF_STOCK" | "NOT_FOUND"; message: string };

/**
 * Atomic-conditional finalize for a gateway-confirmed payment: decrement
 * stock per line (0-row hit = race → restock partials, mark failed so ops
 * can refund), flip to paid_online/paid, queue mails, clear the cart.
 * Idempotent: an already-paid order with the same ref returns success.
 */
export async function finalizePaidOrder(
  orderId: string,
  pay: PaidFinalizeInput,
): Promise<FinalizeResult> {
  const order = (
    await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  )[0];
  if (!order) {
    return { ok: false, code: "NOT_FOUND", message: "Order not found." };
  }
  if (order.status === "paid_online" && order.paystackRef === pay.reference) {
    return { ok: true, orderId: order.id, number: order.number };
  }
  if (order.status !== "awaiting_payment" && order.status !== "failed") {
    // Money arrived for an order ops already moved — keep history intact.
    if (order.status === "paid_online") {
      return { ok: true, orderId: order.id, number: order.number };
    }
    return {
      ok: false,
      code: "NOT_FOUND",
      message: `Order is ${order.status} — contact the shop so we can reconcile payment ${pay.reference}.`,
    };
  }

  const lines = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  // Atomic per-line conditional decrement (same pattern as COD createOrder).
  const decremented: { productId: string; qty: number }[] = [];
  for (const l of lines) {
    const res = (await db.execute(
      sql`UPDATE products SET stock = stock - ${l.qty} WHERE id = ${l.productId} AND stock >= ${l.qty} RETURNING id`,
    )) as unknown as unknown[];
    if (res.length === 0) {
      for (const d of decremented) {
        await db.execute(
          sql`UPDATE products SET stock = stock + ${d.qty} WHERE id = ${d.productId}`,
        );
      }
      // Paid but unsuppliable — failed (not cancelled) so the refund path
      // in admin cancel stays available; paymentStatus paid flags the money.
      await db
        .update(orders)
        .set({ status: "failed", paymentStatus: "paid", paystackRef: pay.reference })
        .where(eq(orders.id, order.id));
      const pname =
        (
          await db
            .select({ name: products.name })
            .from(products)
            .where(eq(products.id, l.productId))
            .limit(1)
        )[0]?.name ?? "An item";
      return {
        ok: false,
        code: "OUT_OF_STOCK",
        message: `${pname} just sold out — your payment (${pay.reference}) is recorded and the shop will refund or replace it. Contact us if you hear nothing within 24 hours.`,
      };
    }
    decremented.push({ productId: l.productId, qty: l.qty });
  }

  await db
    .update(orders)
    .set({
      status: "paid_online",
      paymentStatus: "paid",
      paystackRef: pay.reference,
      paidAt: pay.paidAt ?? new Date(),
      paystackAuth: {
        last4: pay.last4,
        brand: pay.brand,
        channel: pay.channel,
      },
    })
    .where(eq(orders.id, order.id));

  await queueOrderEmails(order.id, order.email);

  const cart = (
    await db.select().from(carts).where(eq(carts.userId, order.userId)).limit(1)
  )[0];
  if (cart) {
    await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
  }

  fireNotify(order.id);
  return { ok: true, orderId: order.id, number: order.number };
}

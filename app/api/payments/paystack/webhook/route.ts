import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import {
  isPaystackSignatureValid,
  paystackSecret,
  verifyPaystackTransaction,
  PaystackError,
} from "@/lib/paystack";
import { finalizePaidOrder } from "@/lib/payments";

export const dynamic = "force-dynamic";

// Paystack webhook: raw body → HMAC-SHA512 signature check → idempotent
// finalize by reference. Non-200s make Paystack retry, so signature/infra
// failures are 400/500 while already-handled or benign events are 200.
export async function POST(req: Request) {
  const secret = paystackSecret();
  if (!secret) {
    return NextResponse.json(
      { ok: false, code: "PAYSTACK_CONFIG" },
      { status: 500 },
    );
  }

  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature");
  if (!(await isPaystackSignatureValid(raw, signature, secret))) {
    return NextResponse.json(
      { ok: false, code: "BAD_SIGNATURE" },
      { status: 400 },
    );
  }

  let event: { event?: unknown; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, code: "BAD_JSON" }, { status: 400 });
  }

  if (event.event !== "charge.success") {
    // Failed/abandoned charges and refunds need no action here (verify and
    // admin-cancel own those transitions) — ack so Paystack stops retrying.
    return NextResponse.json({ ok: true, deduped: true });
  }

  const data = event.data ?? {};
  const reference =
    typeof data.reference === "string" ? data.reference.trim() : "";
  if (!reference) {
    return NextResponse.json({ ok: false, code: "NO_REFERENCE" }, { status: 400 });
  }

  const order = (
    await db.select().from(orders).where(eq(orders.paystackRef, reference)).limit(1)
  )[0];
  if (!order) {
    // Unknown reference (e.g. a test event) — ack, nothing to fulfill.
    return NextResponse.json({ ok: true, deduped: true });
  }
  if (order.status === "paid_online") {
    return NextResponse.json({ ok: true, deduped: true });
  }

  // Re-verify server-to-server before touching stock/mails — the event is a
  // hint, the verify endpoint is the truth.
  let gateway;
  try {
    gateway = await verifyPaystackTransaction(reference, secret);
  } catch (e) {
    const code = e instanceof PaystackError ? e.code : "GATEWAY_ERROR";
    return NextResponse.json({ ok: false, code }, { status: 502 });
  }
  if (gateway.status !== "success") {
    if (order.status === "awaiting_payment") {
      await db
        .update(orders)
        .set({ status: "failed", paymentStatus: "failed" })
        .where(eq(orders.id, order.id));
    }
    return NextResponse.json({ ok: true, deduped: true });
  }
  if (gateway.amountKobo !== order.totalBaseCents) {
    await db
      .update(orders)
      .set({ status: "failed", paymentStatus: "paid", paystackRef: gateway.reference })
      .where(eq(orders.id, order.id));
    return NextResponse.json({ ok: true, deduped: true });
  }

  const finalized = await finalizePaidOrder(order.id, {
    reference: gateway.reference,
    amountKobo: gateway.amountKobo,
    channel: gateway.channel,
    last4: gateway.last4,
    brand: gateway.brand,
    paidAt: gateway.paidAt ? new Date(gateway.paidAt) : new Date(),
  });
  if (!finalized.ok && finalized.code === "NOT_FOUND") {
    return NextResponse.json({ ok: false, code: "INVALID_STATE" }, { status: 409 });
  }
  // OUT_OF_STOCK parks the order as failed/paid for the refund path — still
  // ack 200 so Paystack stops retrying a fully-handled event.
  return NextResponse.json({ ok: true, orderId: order.id });
}

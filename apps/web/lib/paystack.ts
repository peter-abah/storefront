// Paystack helpers — pure + thin API clients. No DB imports (callers own
// persistence); safe for server actions and route handlers. Money rule:
// amounts are INTEGER base minor units end-to-end. The base currency is NGN,
// so base cents == kobo 1:1 — the frozen fx snapshot on the order is the
// only conversion basis, never a live rate.

export const PAYSTACK_VERIFY_URL = "https://api.paystack.co/transaction/verify";
export const PAYSTACK_REFUND_URL = "https://api.paystack.co/refund";
export const PAYSTACK_INLINE_JS = "https://js.paystack.co/v1/inline.js";
/** Paystack charges NGN in kobo. */
export const PAYSTACK_CURRENCY = "NGN";

export function paystackSecret(): string {
  return (process.env.PAYSTACK_SECRET_KEY ?? "").trim();
}

export function paystackPublicKey(): string {
  return (
    (process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "").trim() ||
    (process.env.PAYSTACK_PUBLIC_KEY ?? "").trim()
  );
}

/**
 * Base minor units → Paystack kobo. Identity while the base currency is NGN
 * (1 naira = 100 kobo); validated integer so fractional totals can never
 * reach the gateway.
 */
export function baseCentsToKobo(totalBaseCents: number): number {
  if (!Number.isInteger(totalBaseCents) || totalBaseCents <= 0) {
    throw new Error("[paystack] amount must be a positive integer of base cents.");
  }
  return totalBaseCents;
}

/** Kobo quote for the confirm modal (e.g. 250000 kobo = ₦2,500). */
export function formatKobo(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en")}`;
}

/** Server-minted idempotency reference for one init attempt. */
export function genPaystackRef(orderNumber: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `PSK-${orderNumber}-${s}`;
}

export type PaystackVerifyData = {
  reference: string;
  amountKobo: number;
  status: string;
  channel?: string;
  last4?: string;
  brand?: string;
  paidAt?: string;
};

export class PaystackError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PaystackError";
    this.code = code;
  }
}

/** Server-side verify: GET /transaction/verify/:reference (secret bearer). */
export async function verifyPaystackTransaction(
  reference: string,
  secret: string,
): Promise<PaystackVerifyData> {
  if (!secret) {
    throw new PaystackError(
      "PAYSTACK_CONFIG",
      "Online payment is not configured yet — contact the shop.",
    );
  }
  let res: Response;
  try {
    res = await fetch(`${PAYSTACK_VERIFY_URL}/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
  } catch {
    throw new PaystackError("GATEWAY_UNREACHABLE", "Could not reach Paystack — try again.");
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    throw new PaystackError("GATEWAY_ERROR", "Paystack returned an unreadable response.");
  }
  const data = (body as { data?: Record<string, unknown> })?.data;
  if (!res.ok || !data) {
    const msg =
      (body as { message?: unknown })?.message ??
      `Paystack verify failed (${res.status}).`;
    throw new PaystackError("VERIFY_FAILED", String(msg).slice(0, 200));
  }
  const auth = (data.authorization ?? {}) as Record<string, unknown>;
  return {
    reference: String(data.reference ?? reference),
    amountKobo: Number(data.amount ?? NaN),
    status: String(data.status ?? ""),
    channel: typeof data.channel === "string" ? data.channel : undefined,
    last4: typeof auth.last_4 === "string" ? auth.last_4 : undefined,
    brand: typeof auth.brand === "string" ? auth.brand : undefined,
    paidAt: typeof data.paid_at === "string" ? data.paid_at : undefined,
  };
}

/** Cancel-prepaid refund: POST /refund { transaction: reference }. */
export async function refundPaystackTransaction(
  reference: string,
  secret: string,
): Promise<{ ok: boolean; message: string }> {
  if (!secret) {
    throw new PaystackError(
      "PAYSTACK_CONFIG",
      "Paystack secret is missing — refund manually in the Paystack dashboard.",
    );
  }
  let res: Response;
  try {
    res = await fetch(PAYSTACK_REFUND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transaction: reference }),
    });
  } catch {
    throw new PaystackError("GATEWAY_UNREACHABLE", "Could not reach Paystack for the refund.");
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg =
      (body as { message?: unknown })?.message ?? `Refund failed (${res.status}).`;
    throw new PaystackError("REFUND_FAILED", String(msg).slice(0, 200));
  }
  return { ok: true, message: "Refund initiated via Paystack." };
}

/** Webhook HMAC-SHA512 check over the RAW body (Web Crypto Subtle — no
 *  node: imports so this module stays safe for the client bundle, which
 *  imports the kobo/inline constants for the confirm modal + popup). */
export async function isPaystackSignatureValid(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!secret || !signatureHeader) return false;
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return false;
    const key = await subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"],
    );
    const sig = await subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const digest = [...new Uint8Array(sig)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const a = digest.toLowerCase();
    const b = signatureHeader.trim().toLowerCase();
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}

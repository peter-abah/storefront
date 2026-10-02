// Idempotent order-notify worker (PRD F9 / ARCH §6). Used by
// `app/api/orders/notify/route.ts` and the Wave 5 live-fire script.
// One call fans out 3 kinds: buyer_confirm → order.email,
// owner_fulfill → OWNER_EMAIL, admin_digest → ADMIN_EMAILS[0].
// Mailgun sandbox exception: when EMAIL_PROVIDER=mailgun and the domain
// contains "sandbox", ALL three redirect to TEST_INBOX (sandbox rejects
// non-authorized recipients) and the actual address is recorded in
// `email_log.to_email`.

import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  currencies,
  emailLog,
  orderItems,
  orders,
  products,
  shippingRates,
  shippingZones,
} from "@/lib/db/schema";
import { formatDisplay, toDisplay } from "@/lib/money";
import { CONTACT, appUrl as getAppUrl, supportEmail } from "@/lib/contact";
import { getEmailProvider, providerKey } from "@/lib/email";
import { EmailSendError } from "@/lib/email/provider";
import {
  orderAdminDigest,
  orderBuyerConfirm,
  orderOwnerSlip,
  type EmailTemplate,
  type OrderEmailView,
} from "@/lib/email/templates";

export const EMAIL_KINDS = [
  "buyer_confirm",
  "owner_fulfill",
  "admin_digest",
] as const;

export type EmailKind = (typeof EMAIL_KINDS)[number];

/** Pending row younger than this with attempts > 0 = another worker is on it.
 * NOTE: email_log has no updated_at column (schema-frozen) — created_at is
 * the staleness clock. Fresh checkout rows have attempts=0 and proceed. */
const IN_PROGRESS_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
/** Retry delays before attempt 2 and 3 (≈1s / ≈4s + jitter).
 * 16s third delay dropped to keep the handler <25s total worst-case
 * (3 kinds × (1+4)s sleeps ≈ 15s + sends). */
const RETRY_DELAYS_MS = [1000, 4000];

export type NotifyKindStatus = "sent" | "failed" | "deduped" | "in_progress";

export type NotifyKindResult = {
  kind: EmailKind;
  toEmail: string;
  status: NotifyKindStatus;
  providerMsgId?: string;
  attempts: number;
  error?: string;
};

export type NotifyResult = {
  ok: true;
  orderId: string;
  results: NotifyKindResult[];
  /** Every kind was already sent (safe to skip). */
  deduped: boolean;
  /** No kind was (re)sent; at least one is mid-flight elsewhere. */
  inProgress: boolean;
};

export class NotifyError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "NotifyError";
    this.status = status;
    this.code = code;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function withJitter(ms: number): number {
  return Math.round(ms * (0.8 + Math.random() * 0.4));
}

function firstAdminEmail(): string | null {
  const first = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return first || null;
}

function ownerEmailOf(fallback: string): string {
  return (
    process.env.OWNER_EMAIL?.trim() || firstAdminEmail() || fallback
  );
}

function isSandboxMailgun(): boolean {
  return (
    (providerKey() || "mailgun") === "mailgun" &&
    (process.env.MAILGUN_DOMAIN || "").includes("sandbox")
  );
}

/** Fixed recipients per kind, with the sandbox redirect applied. */
function resolveRecipients(orderEmail: string): {
  map: Record<EmailKind, string>;
  sandboxRedirect: boolean;
} {
  const owner = ownerEmailOf(orderEmail);
  const admin = firstAdminEmail() || owner;
  const natural: Record<EmailKind, string> = {
    buyer_confirm: orderEmail,
    owner_fulfill: owner,
    admin_digest: admin,
  };
  if (!isSandboxMailgun()) return { map: natural, sandboxRedirect: false };
  const testInbox = process.env.TEST_INBOX?.trim();
  if (!testInbox) {
    throw new NotifyError(
      500,
      "EMAIL_CONFIG",
      "Mailgun sandbox mode requires TEST_INBOX (authorized recipient).",
    );
  }
  return {
    map: {
      buyer_confirm: testInbox,
      owner_fulfill: testInbox,
      admin_digest: testInbox,
    },
    sandboxRedirect: true,
  };
}

function templateFor(kind: EmailKind, view: OrderEmailView): EmailTemplate {
  if (kind === "buyer_confirm") return orderBuyerConfirm(view);
  if (kind === "owner_fulfill") return orderOwnerSlip(view);
  return orderAdminDigest(view);
}

async function buildView(
  order: typeof orders.$inferSelect,
): Promise<OrderEmailView> {
  const lines = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  const currency = (
    await db
      .select()
      .from(currencies)
      .where(eq(currencies.code, order.currencyCode))
      .limit(1)
  )[0];
  if (!currency) {
    throw new NotifyError(
      404,
      "NOT_FOUND",
      "Order currency is no longer configured.",
    );
  }
  const money = (baseCents: number): string =>
    formatDisplay(toDisplay(baseCents, currency.rateToBase), {
      code: currency.code,
      symbol: currency.symbol,
    });

  const viewLines: OrderEmailView["lines"] = [];
  for (const l of lines) {
    const p = (
      await db
        .select({ name: products.name, slug: products.slug, stock: products.stock })
        .from(products)
        .where(eq(products.id, l.productId))
        .limit(1)
    )[0];
    const unit = money(l.unitBaseCents);
    viewLines.push({
      name: p?.name ?? "Removed product",
      qty: l.qty,
      unitDisplay: unit,
      // Amounts are frozen per-unit snapshots; format the extended price
      // in display units (half-up, same rule as checkout display).
      lineDisplay: formatDisplay(
        toDisplay(l.unitBaseCents * l.qty, currency.rateToBase),
        { code: currency.code, symbol: currency.symbol },
      ),
      // SKU = slug; stock at notify time (owner/admin slips).
      sku: p?.slug ?? l.productId.slice(0, 8),
      stock: p?.stock ?? null,
    });
  }

  const zone = (
    await db
      .select({ name: shippingZones.name })
      .from(shippingZones)
      .where(eq(shippingZones.id, order.address.zoneId))
      .limit(1)
  )[0];
  const tiers = await db
    .select()
    .from(shippingRates)
    .where(eq(shippingRates.zoneId, order.address.zoneId))
    .orderBy(desc(shippingRates.minSubtotalCents));
  const tier =
    tiers.find((t) => order.subtotalBaseCents >= t.minSubtotalCents) ??
    [...tiers].reverse()[0] ??
    null;

  // Localhost fallback is dev-only (lib/contact.ts); prod sets APP_URL or NEXT_PUBLIC_APP_URL.
  const baseUrl = getAppUrl();
  const support = ownerEmailOf(order.email);
  // Payment columns ship with migration 0002; read defensively so a stale
  // DB still sends the COD copy instead of crashing the worker.
  const paymentMethod =
    typeof (order as { paymentMethod?: unknown }).paymentMethod === "string"
      ? (order as { paymentMethod?: string }).paymentMethod
      : "cod";
  const paystackRef =
    typeof (order as { paystackRef?: unknown }).paystackRef === "string"
      ? (order as { paystackRef?: string | null }).paystackRef
      : null;
  const auth =
    (order as { paystackAuth?: unknown }).paystackAuth as {
      last4?: string;
      brand?: string;
    } | null;
  return {
    orderNumber: order.number,
    buyerName: order.address.name,
    buyerEmail: order.email,
    buyerPhone: order.address.phone,
    address: {
      name: order.address.name,
      phone: order.address.phone,
      street: order.address.street,
      city: order.address.city,
      state: order.address.state,
      postal: order.address.postal,
      country: order.address.country,
      zoneName: zone?.name ?? null,
      notes: order.address.notes ?? null,
    },
    lines: viewLines,
    currencyCode: order.currencyCode,
    subtotalDisplay: money(order.subtotalBaseCents),
    shippingDisplay: money(order.shippingBaseCents),
    totalDisplay: money(order.totalBaseCents),
    etaDays: tier?.etaDays ?? null,
    orderUrl: `${baseUrl}/orders/${order.id}`,
    confirmUrl: `${baseUrl}/admin/orders?order=${order.id}`,
    adminUrl: `${baseUrl}/admin/orders?order=${order.id}`,
    supportEmail: support,
    supportPhone: CONTACT.phoneDisplay,
    shopAddress: CONTACT.address,
    shopHours: CONTACT.hours,
    whatsappUrl: CONTACT.whatsappUrl,
    whatsappDisplay: CONTACT.whatsappDisplay,
    shippingUrl: `${baseUrl}/shipping`,
    returnsUrl: `${baseUrl}/returns`,
    contactUrl: `${baseUrl}/contact`,
    paymentMethod,
    paystackRef,
    cardLast4: auth?.last4 ?? null,
    cardBrand: auth?.brand ?? null,
  };
}

async function sendKind(
  orderId: string,
  kind: EmailKind,
  toEmail: string,
  tpl: EmailTemplate,
  providerName: string,
  opts?: { force?: boolean },
): Promise<NotifyKindResult> {
  const existing = (
    await db
      .select()
      .from(emailLog)
      .where(and(eq(emailLog.orderId, orderId), eq(emailLog.kind, kind)))
      .limit(1)
  )[0];

  // Claim: already sent → dedupe (unless force bypass for admin resend).
  // Fresh pending (attempts 0, e.g. just created by checkout) → proceed.
  // Pending with attempts + young → another worker is mid-flight.
  // Failed/stale → reset and proceed.
  if (existing?.status === "sent" && !opts?.force) {
    return {
      kind,
      toEmail: existing.toEmail,
      status: "deduped",
      providerMsgId: existing.providerMsgId ?? undefined,
      attempts: existing.attempts,
    };
  }
  if (existing) {
    const ageMs = Date.now() - new Date(existing.createdAt).getTime();
    if (
      existing.status === "pending" &&
      existing.attempts > 0 &&
      ageMs < IN_PROGRESS_MS
    ) {
      return {
        kind,
        toEmail: existing.toEmail,
        status: "in_progress",
        attempts: existing.attempts,
      };
    }
  }

  let rowId: string;
  if (!existing) {
    const [row] = await db
      .insert(emailLog)
      .values({
        orderId,
        kind,
        toEmail, // actual recipient (sandbox redirect already applied)
        provider: providerName,
        status: "pending",
        attempts: 0,
      })
      .returning();
    rowId = row!.id;
  } else {
    await db
      .update(emailLog)
      .set({ toEmail, provider: providerName, status: "pending", attempts: 0 })
      .where(eq(emailLog.id, existing.id));
    rowId = existing.id;
  }

  const provider = getEmailProvider();
  let lastError = "unknown error";
  // Reply-to = support mailbox so buyer replies reach the shop, not the sandbox sender.
  const replyTo = toEmail.includes("@") ? supportEmail() : undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await provider.send({
        to: toEmail,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        replyTo,
      });
      await db
        .update(emailLog)
        .set({
          status: "sent",
          providerMsgId: res.id,
          sentAt: new Date(),
          attempts: attempt,
          lastError: null,
        })
        .where(eq(emailLog.id, rowId));
      return {
        kind,
        toEmail,
        status: "sent",
        providerMsgId: res.id,
        attempts: attempt,
      };
    } catch (e) {
      const retryable = e instanceof EmailSendError ? e.retryable : true;
      const msg =
        e instanceof EmailSendError
          ? (e.providerMessage ?? e.message)
          : ((e as Error)?.message ?? String(e));
      lastError = msg.slice(0, 500);
      await db
        .update(emailLog)
        .set({ attempts: attempt, lastError })
        .where(eq(emailLog.id, rowId));
      if (!retryable) break; // fail fast on 4xx (incl. sandbox rejects)
      if (attempt < MAX_ATTEMPTS) {
        await sleep(withJitter(RETRY_DELAYS_MS[attempt - 1]!));
      }
    }
  }

  await db
    .update(emailLog)
    .set({ status: "failed", lastError })
    .where(eq(emailLog.id, rowId));
  return { kind, toEmail, status: "failed", attempts: MAX_ATTEMPTS, error: lastError };
}

/**
 * Idempotent fan-out for one order. Throws NotifyError (400/404/500) for
 * bad input, missing order, or misconfiguration — the route maps these to
 * HTTP. Provider 4xx fail fast per kind; 429/5xx/network retry 3x
 * (sequential kinds, ~1s/4s+jitter, handler <25s typical).
 * Returns {ok, results:[{kind,status,providerMsgId,...}]} (superset keeps
 * toEmail/attempts for observability; route maps to the minimal shape).
 */
export async function notifyOrder(
  orderIdInput: unknown,
  opts?: { force?: boolean; kinds?: EmailKind[] },
): Promise<NotifyResult> {
  const parsed = z.string().uuid().safeParse(orderIdInput);
  if (!parsed.success) {
    throw new NotifyError(400, "INVALID_INPUT", "orderId must be a UUID.");
  }
  const orderId = parsed.data;

  const order = (
    await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  )[0];
  if (!order) {
    throw new NotifyError(404, "NOT_FOUND", "Order not found.");
  }

  const { map: recipients } = resolveRecipients(order.email);
  const view = await buildView(order);
  const providerName = getEmailProvider().name;

  const kinds = opts?.kinds ?? [...EMAIL_KINDS];
  const results: NotifyKindResult[] = [];
  for (const kind of kinds) {
    results.push(
      await sendKind(orderId, kind, recipients[kind], templateFor(kind, view), providerName, {
        force: opts?.force,
      }),
    );
  }

  const deduped = results.every((r) => r.status === "deduped");
  const anyLive = results.some(
    (r) => r.status === "sent" || r.status === "failed",
  );
  return {
    ok: true as const,
    orderId,
    results,
    deduped,
    inProgress: !deduped && !anyLive,
  };
}

/**
 * Admin resend path (Wave 6 Resend button reuses this): same worker as
 * notifyOrder but with explicit bypass of the sent-dedupe. When `kind` is
 * given, force that kind even if already sent; when omitted, force all
 * non-sent kinds (pending + failed) — sent rows stay deduped unless a kind
 * is explicitly named.
 */
export async function resendFailed(
  orderIdInput: unknown,
  kindInput?: unknown,
): Promise<NotifyResult> {
  if (kindInput !== undefined) {
    const parsedKind = z.enum(EMAIL_KINDS).safeParse(kindInput);
    if (!parsedKind.success) {
      throw new NotifyError(
        400,
        "INVALID_INPUT",
        "kind must be one of buyer_confirm | owner_fulfill | admin_digest.",
      );
    }
    return notifyOrder(orderIdInput, { force: true, kinds: [parsedKind.data] });
  }
  // No kind named: resend pending + failed via the same path, forcing the
  // worker past stale claims. First load current log to pick targets.
  const parsed = z.string().uuid().safeParse(orderIdInput);
  if (!parsed.success) {
    throw new NotifyError(400, "INVALID_INPUT", "orderId must be a UUID.");
  }
  const orderId = parsed.data;
  const rows = await db
    .select()
    .from(emailLog)
    .where(eq(emailLog.orderId, orderId));
  const pendingKinds = rows
    .filter((r) => r.status !== "sent")
    .map((r) => r.kind as EmailKind)
    .filter((k) => (EMAIL_KINDS as readonly string[]).includes(k));
  // No log rows yet (or all sent): run the normal path (no force) so sent
  // rows dedupe instead of double-sending.
  if (pendingKinds.length === 0) return notifyOrder(orderId);
  return notifyOrder(orderId, { force: true, kinds: pendingKinds });
}

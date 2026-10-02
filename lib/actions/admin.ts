"use server";

import { and, asc, count, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
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
import { getSessionProfile, type SessionProfile } from "@/lib/auth-session";
import { canTransition, ORDER_STATUSES, type OrderStatus } from "@/lib/order-machine";
import { EMAIL_KINDS, NotifyError, resendFailed } from "@/lib/email/notify";
import type { ActionResult } from "./cart";

const ADMIN_PAGE_SIZE = 20;

async function requireAdmin(): Promise<SessionProfile | null> {
  const sp = await getSessionProfile();
  if (!sp || sp.profile.role !== "admin") return null;
  return sp;
}

function forbidden<T>(): ActionResult<T> {
  return { ok: false, code: "FORBIDDEN", message: "Not authorized — admin only." };
}

function escapeLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROOMS = ["living", "bedroom", "dining", "bath", "decor", "outdoor"] as const;
const CATEGORIES = ["furniture", "lighting", "textiles", "decor", "tableware"] as const;

function parsePage(input: unknown): number {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

// --- Products ---

export type AdminProduct = typeof products.$inferSelect;

export async function listProductsAdmin(
  input?: unknown,
): Promise<ActionResult<{ items: AdminProduct[]; total: number; page: number; perPage: number }>> {
  const sp = await requireAdmin();
  if (!sp) return forbidden();
  const raw = (input ?? {}) as { search?: unknown; page?: unknown };
  const search = typeof raw.search === "string" ? raw.search.trim().slice(0, 120) : "";
  const page = parsePage(raw.page);
  const perPage = ADMIN_PAGE_SIZE;
  const offset = (page - 1) * perPage;

  const like = `%${escapeLike(search)}%`;
  const whereClause = search
    ? sql`(${products.name} ILIKE ${like} OR ${products.slug} ILIKE ${like})`
    : undefined;

  const [items, totalRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(desc(products.createdAt))
      .limit(perPage)
      .offset(offset),
    db
      .select({ value: count() })
      .from(products)
      .where(whereClause),
  ]);
  return { ok: true, data: { items, total: totalRows[0]?.value ?? 0, page, perPage } };
}

const productUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Name needs at least 2 characters.").max(160),
  slug: z.string().trim().max(140).optional().default(""),
  tagline: z.string().trim().max(240).optional().default(""),
  story: z.string().trim().max(8000).optional().default(""),
  priceBaseCents: z.coerce.number().int("Price must be a whole number of cents.").min(0, "Price can't be negative."),
  stock: z.coerce.number().int("Stock must be whole units.").min(0, "Stock can't be negative."),
  room: z.enum(ROOMS),
  category: z.enum(CATEGORIES),
  materialsText: z.string().optional().default(""),
  dimW: z.coerce.number().min(0).optional(),
  dimD: z.coerce.number().min(0).optional(),
  dimH: z.coerce.number().min(0).optional(),
  dimUnit: z.string().trim().max(12).optional().default("cm"),
  weightKg: z.string().trim().max(20).optional().default(""),
  care: z.string().trim().max(2000).optional().default(""),
  imagesText: z.string().optional().default(""),
  active: z.boolean().optional().default(true),
  featured: z.boolean().optional().default(false),
});

function parseHttpUrl(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  if (!/^https?:\/\/.+/i.test(t)) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return t;
  } catch {
    return null;
  }
}

export async function upsertProduct(input: unknown): Promise<ActionResult<AdminProduct>> {
  const sp = await requireAdmin();
  if (!sp) return forbidden();
  const parsed = productUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Check the product form." };
  }
  const v = parsed.data;

  let slug = v.slug.trim();
  if (!slug) slug = slugify(v.name);
  if (!slug || !SLUG_RE.test(slug)) {
    return { ok: false, code: "INVALID_INPUT", message: "Slug must be lowercase letters, numbers and hyphens (auto-filled from the name when blank)." };
  }

  const clash = (await db.select().from(products).where(eq(products.slug, slug)).limit(1))[0];
  if (clash && clash.id !== v.id) {
    return { ok: false, code: "CONFLICT", message: `Slug “${slug}” is already used by another product.` };
  }

  const materials = v.materialsText
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean)
    .slice(0, 20);

  const hasDim = v.dimW !== undefined || v.dimD !== undefined || v.dimH !== undefined;
  let dimensions: { w: number; d: number; h: number; unit: string } | null = null;
  if (hasDim) {
    if (v.dimW === undefined || v.dimD === undefined || v.dimH === undefined) {
      return { ok: false, code: "INVALID_INPUT", message: "Dimensions need width, depth and height together — or leave all three blank." };
    }
    if (!Number.isFinite(v.dimW) || !Number.isFinite(v.dimD) || !Number.isFinite(v.dimH)) {
      return { ok: false, code: "INVALID_INPUT", message: "Dimensions must be numbers." };
    }
    dimensions = { w: v.dimW, d: v.dimD, h: v.dimH, unit: (v.dimUnit || "cm").slice(0, 12) };
  }

  let weight: string | null = null;
  const wRaw = (v.weightKg ?? "").trim();
  if (wRaw) {
    if (!/^\d+(\.\d+)?$/.test(wRaw) || !(Number(wRaw) > 0)) {
      return { ok: false, code: "INVALID_INPUT", message: "Weight must be a positive number in kg (e.g. 12.5)." };
    }
    weight = wRaw;
  }

  const imageUrls = (v.imagesText ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (imageUrls.length > 10) {
    return { ok: false, code: "INVALID_INPUT", message: "Keep at most 10 image URLs (one per line)." };
  }
  for (const u of imageUrls) {
    if (!parseHttpUrl(u)) {
      return { ok: false, code: "INVALID_INPUT", message: `Image URL must start with http(s):// — check “${u.slice(0, 60)}”.` };
    }
  }
  const images = imageUrls.map((url) => ({ url }));

  const row = {
    slug,
    name: v.name.trim(),
    tagline: v.tagline.trim() ? v.tagline.trim() : null,
    story: v.story.trim() ? v.story.trim() : null,
    priceBaseCents: v.priceBaseCents,
    stock: v.stock,
    room: v.room,
    category: v.category,
    materials: materials.length > 0 ? materials : null,
    dimensions,
    weightKg: weight,
    care: v.care.trim() ? v.care.trim() : null,
    images,
    active: v.active,
    featured: v.featured,
  };

  if (v.id) {
    const existing = (await db.select().from(products).where(eq(products.id, v.id)).limit(1))[0];
    if (!existing) return { ok: false, code: "NOT_FOUND", message: "Product not found." };
    const updated = (await db.update(products).set(row).where(eq(products.id, v.id)).returning())[0];
    if (!updated) return { ok: false, code: "NOT_FOUND", message: "Product not found." };
    return { ok: true, data: updated };
  }
  const inserted = (await db.insert(products).values(row).returning())[0];
  if (!inserted) return { ok: false, code: "ORDER_FAILED", message: "Could not create the product." };
  return { ok: true, data: inserted };
}

export async function toggleProductActive(
  id: unknown,
  active?: unknown,
): Promise<ActionResult<{ id: string; active: boolean }>> {
  const sp = await requireAdmin();
  if (!sp) return forbidden();
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return { ok: false, code: "INVALID_INPUT", message: "Invalid product." };
  let next: boolean | undefined;
  if (active !== undefined) {
    const p = z.boolean().safeParse(active);
    if (!p.success) return { ok: false, code: "INVALID_INPUT", message: "Active must be true or false." };
    next = p.data;
  }
  const current = (await db.select().from(products).where(eq(products.id, parsedId.data)).limit(1))[0];
  if (!current) return { ok: false, code: "NOT_FOUND", message: "Product not found." };
  const value = next ?? !current.active;
  await db.update(products).set({ active: value }).where(eq(products.id, current.id));
  return { ok: true, data: { id: current.id, active: value } };
}

export async function adjustStock(
  id: unknown,
  delta: unknown,
): Promise<ActionResult<{ id: string; stock: number }>> {
  const sp = await requireAdmin();
  if (!sp) return forbidden();
  const parsedId = z.string().uuid().safeParse(id);
  const parsedDelta = z.coerce.number().int().min(-100000).max(100000).safeParse(delta);
  if (!parsedId.success || !parsedDelta.success) {
    return { ok: false, code: "INVALID_INPUT", message: "Stock change must be a whole number." };
  }
  const current = (await db.select().from(products).where(eq(products.id, parsedId.data)).limit(1))[0];
  if (!current) return { ok: false, code: "NOT_FOUND", message: "Product not found." };
  const next = Math.max(0, current.stock + parsedDelta.data);
  await db.update(products).set({ stock: next }).where(eq(products.id, current.id));
  return { ok: true, data: { id: current.id, stock: next } };
}

// --- Orders ---

export type AdminOrderRow = typeof orders.$inferSelect & { itemCount: number };

export async function listOrdersAdmin(
  input?: unknown,
): Promise<ActionResult<{ items: AdminOrderRow[]; total: number; page: number; perPage: number }>> {
  const sp = await requireAdmin();
  if (!sp) return forbidden();
  const raw = (input ?? {}) as { status?: unknown; page?: unknown };
  const statusRaw = typeof raw.status === "string" ? raw.status : "all";
  const status = statusRaw === "all" ? "all" : (ORDER_STATUSES as readonly string[]).includes(statusRaw) ? statusRaw : null;
  if (!status) return { ok: false, code: "INVALID_INPUT", message: "Unknown order status." };
  const page = parsePage(raw.page);
  const perPage = ADMIN_PAGE_SIZE;
  const offset = (page - 1) * perPage;
  const whereClause = status === "all" ? undefined : eq(orders.status, status);

  const [rows, totalRows] = await Promise.all([
    db.select().from(orders).where(whereClause).orderBy(desc(orders.createdAt)).limit(perPage).offset(offset),
    db.select({ value: count() }).from(orders).where(whereClause),
  ]);
  const items: AdminOrderRow[] = [];
  for (const o of rows) {
    const [{ value }] = await db.select({ value: count() }).from(orderItems).where(eq(orderItems.orderId, o.id));
    items.push({ ...o, itemCount: value ?? 0 });
  }
  return { ok: true, data: { items, total: totalRows[0]?.value ?? 0, page, perPage } };
}

export async function transitionOrder(
  id: unknown,
  to: unknown,
): Promise<ActionResult<{ id: string; status: string }>> {
  const sp = await requireAdmin();
  if (!sp) return forbidden();
  const parsedId = z.string().uuid().safeParse(id);
  const parsedTo = z.enum(ORDER_STATUSES).safeParse(to);
  if (!parsedId.success || !parsedTo.success) {
    return { ok: false, code: "INVALID_INPUT", message: "Invalid order or target status." };
  }
  const order = (await db.select().from(orders).where(eq(orders.id, parsedId.data)).limit(1))[0];
  if (!order) return { ok: false, code: "NOT_FOUND", message: "Order not found." };
  const from = order.status as OrderStatus;
  const target = parsedTo.data;
  if (from === target) return { ok: true, data: { id: order.id, status: from } };
  if (!canTransition(from, target)) {
    return { ok: false, code: "INVALID_TRANSITION", message: `Cannot move ${from} → ${target}. Follow the lifecycle: pending → confirmed → out for delivery → delivered → paid.` };
  }
  if (target === "cancelled") {
    const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    for (const l of lines) {
      await db.execute(sql`UPDATE products SET stock = stock + ${l.qty} WHERE id = ${l.productId}`);
    }
    await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, order.id));
    return { ok: true, data: { id: order.id, status: "cancelled" } };
  }
  await db.update(orders).set({ status: target }).where(eq(orders.id, order.id));
  return { ok: true, data: { id: order.id, status: target } };
}

// --- Dashboard stats (each a single aggregate query) ---

export type AdminStats = {
  pendingCount: number;
  outForDeliveryCount: number;
  lowStockCount: number;
  codCollectedCents: number;
  failedEmailCount: number;
};

export async function getAdminStats(): Promise<ActionResult<AdminStats>> {
  const sp = await requireAdmin();
  if (!sp) return forbidden();
  const [pendingRows, outRows, lowRows, codRows, failedRows] = await Promise.all([
    db.select({ value: count() }).from(orders).where(eq(orders.status, "pending")),
    db.select({ value: count() }).from(orders).where(eq(orders.status, "out_for_delivery")),
    db.select({ value: count() }).from(products).where(and(eq(products.active, true), sql`${products.stock} <= 5`)),
    db
      .select({ value: sql<number>`coalesce(sum(${orders.totalBaseCents}), 0)::int` })
      .from(orders)
      .where(eq(orders.status, "paid_on_delivery")),
    db.select({ value: count() }).from(emailLog).where(eq(emailLog.status, "failed")),
  ]);
  return {
    ok: true,
    data: {
      pendingCount: pendingRows[0]?.value ?? 0,
      outForDeliveryCount: outRows[0]?.value ?? 0,
      lowStockCount: lowRows[0]?.value ?? 0,
      codCollectedCents: codRows[0]?.value ?? 0,
      failedEmailCount: failedRows[0]?.value ?? 0,
    },
  };
}

// --- Currencies ---

export async function listCurrencies(): Promise<ActionResult<(typeof currencies.$inferSelect)[]>> {
  const sp = await requireAdmin();
  if (!sp) return forbidden();
  const rows = await db.select().from(currencies).orderBy(asc(currencies.code));
  return { ok: true, data: rows };
}

const currencySchema = z.object({
  code: z.string().trim().min(1, "Code is required.").max(4),
  symbol: z.string().trim().min(1, "Symbol is required.").max(8),
  label: z.string().trim().min(1, "Label is required.").max(80),
  rateToBase: z.string().trim().min(1, "Rate is required.").max(30),
  active: z.boolean().optional().default(true),
  isBase: z.boolean().optional().default(false),
});

export async function upsertCurrency(input: unknown): Promise<ActionResult<typeof currencies.$inferSelect>> {
  const sp = await requireAdmin();
  if (!sp) return forbidden();
  const parsed = currencySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Check the currency form." };
  }
  const code = parsed.data.code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    return { ok: false, code: "INVALID_INPUT", message: "Code must be 3 letters (e.g. NGN, USD)." };
  }
  const rate = Number(parsed.data.rateToBase.trim());
  if (!Number.isFinite(rate) || rate <= 0) {
    return { ok: false, code: "INVALID_INPUT", message: "Rate to base must be a number above 0." };
  }
  const rateStr = parsed.data.rateToBase.trim();
  const { symbol, label, active, isBase } = parsed.data;

  const all = await db.select().from(currencies);
  const existing = all.find((c) => c.code === code);
  const activeRows = all.filter((c) => c.active);
  const baseRows = all.filter((c) => c.isBase);

  if (existing) {
    if (!active && existing.active && activeRows.length <= 1) {
      return { ok: false, code: "FORBIDDEN", message: "Cannot deactivate the last active currency." };
    }
    if (!isBase && existing.isBase && baseRows.length <= 1) {
      return { ok: false, code: "FORBIDDEN", message: "Cannot unset the only base currency — use Make base to choose a new one instead." };
    }
    if (isBase && !active) {
      return { ok: false, code: "INVALID_INPUT", message: "The base currency must stay active." };
    }
    const updated = (
      await db
        .update(currencies)
        .set({ symbol: symbol.trim(), label: label.trim(), rateToBase: rateStr, active, isBase })
        .where(eq(currencies.code, code))
        .returning()
    )[0];
    if (!updated) return { ok: false, code: "NOT_FOUND", message: "Currency not found." };
    if (isBase) {
      await db.update(currencies).set({ isBase: false }).where(and(ne(currencies.code, code), eq(currencies.isBase, true)));
    }
    return { ok: true, data: (await db.select().from(currencies).where(eq(currencies.code, code)).limit(1))[0]! };
  }

  if (isBase && !active) {
    return { ok: false, code: "INVALID_INPUT", message: "The base currency must stay active." };
  }
  const inserted = (
    await db
      .insert(currencies)
      .values({ code, symbol: symbol.trim(), label: label.trim(), rateToBase: rateStr, active, isBase })
      .returning()
  )[0];
  if (!inserted) return { ok: false, code: "ORDER_FAILED", message: "Could not save the currency." };
  if (isBase) {
    await db.update(currencies).set({ isBase: false }).where(and(ne(currencies.code, code), eq(currencies.isBase, true)));
  }
  return { ok: true, data: inserted };
}

export async function setBaseCurrency(code: unknown): Promise<ActionResult<{ code: string }>> {
  const sp = await requireAdmin();
  if (!sp) return forbidden();
  const raw = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(raw)) {
    return { ok: false, code: "INVALID_INPUT", message: "Code must be 3 letters." };
  }
  const all = await db.select().from(currencies);
  const target = all.find((c) => c.code === raw);
  if (!target) return { ok: false, code: "NOT_FOUND", message: "Currency not found." };
  if (!target.active) {
    return { ok: false, code: "INVALID_INPUT", message: "Only an active currency can become the base." };
  }
  const activeCount = all.filter((c) => c.active).length;
  if (activeCount < 2 && !target.isBase) {
    return { ok: false, code: "FORBIDDEN", message: "Need at least two active currencies to flip the base." };
  }
  await db.update(currencies).set({ isBase: true }).where(eq(currencies.code, raw));
  await db.update(currencies).set({ isBase: false }).where(ne(currencies.code, raw));
  return { ok: true, data: { code: raw } };
}

// --- Zones + rates ---

export type AdminZone = typeof shippingZones.$inferSelect & { rates: (typeof shippingRates.$inferSelect)[] };

export async function listZones(): Promise<ActionResult<AdminZone[]>> {
  const sp = await requireAdmin();
  if (!sp) return forbidden();
  const zones = await db.select().from(shippingZones).orderBy(asc(shippingZones.name));
  const rates = await db.select().from(shippingRates).orderBy(asc(shippingRates.minSubtotalCents));
  return { ok: true, data: zones.map((z) => ({ ...z, rates: rates.filter((r) => r.zoneId === z.id) })) };
}

const zoneSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Zone name needs at least 2 characters.").max(80),
  active: z.boolean().optional().default(true),
});

export async function upsertZone(input: unknown): Promise<ActionResult<typeof shippingZones.$inferSelect>> {
  const sp = await requireAdmin();
  if (!sp) return forbidden();
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Check the zone form." };
  }
  const name = parsed.data.name.trim();
  const clash = (await db.select().from(shippingZones).where(eq(shippingZones.name, name)).limit(1))[0];
  if (clash && clash.id !== parsed.data.id) {
    return { ok: false, code: "CONFLICT", message: `Zone “${name}” already exists.` };
  }
  if (parsed.data.id) {
    const updated = (
      await db.update(shippingZones).set({ name, active: parsed.data.active }).where(eq(shippingZones.id, parsed.data.id)).returning()
    )[0];
    if (!updated) return { ok: false, code: "NOT_FOUND", message: "Zone not found." };
    return { ok: true, data: updated };
  }
  const inserted = (await db.insert(shippingZones).values({ name, active: parsed.data.active }).returning())[0];
  if (!inserted) return { ok: false, code: "ORDER_FAILED", message: "Could not create the zone." };
  return { ok: true, data: inserted };
}

const rateSchema = z.object({
  id: z.string().uuid().optional(),
  zoneId: z.string().uuid("Choose a zone."),
  minSubtotalCents: z.coerce.number().int().min(0, "Minimum subtotal can't be negative."),
  feeCents: z.coerce.number().int().min(0, "Fee can't be negative."),
  etaDays: z.string().trim().min(1, "ETA is required.").max(40),
});

export async function upsertRate(input: unknown): Promise<ActionResult<typeof shippingRates.$inferSelect>> {
  const sp = await requireAdmin();
  if (!sp) return forbidden();
  const parsed = rateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Check the rate form." };
  }
  const zone = (await db.select().from(shippingZones).where(eq(shippingZones.id, parsed.data.zoneId)).limit(1))[0];
  if (!zone) return { ok: false, code: "NOT_FOUND", message: "Zone not found." };
  if (parsed.data.id) {
    const updated = (
      await db
        .update(shippingRates)
        .set({ zoneId: parsed.data.zoneId, minSubtotalCents: parsed.data.minSubtotalCents, feeCents: parsed.data.feeCents, etaDays: parsed.data.etaDays.trim() })
        .where(eq(shippingRates.id, parsed.data.id))
        .returning()
    )[0];
    if (!updated) return { ok: false, code: "NOT_FOUND", message: "Rate not found." };
    return { ok: true, data: updated };
  }
  const inserted = (
    await db
      .insert(shippingRates)
      .values({ zoneId: parsed.data.zoneId, minSubtotalCents: parsed.data.minSubtotalCents, feeCents: parsed.data.feeCents, etaDays: parsed.data.etaDays.trim() })
      .returning()
  )[0];
  if (!inserted) return { ok: false, code: "ORDER_FAILED", message: "Could not create the rate." };
  return { ok: true, data: inserted };
}

export async function deleteRate(id: unknown): Promise<ActionResult<{ id: string }>> {
  const sp = await requireAdmin();
  if (!sp) return forbidden();
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT", message: "Invalid rate." };
  const existing = (await db.select().from(shippingRates).where(eq(shippingRates.id, parsed.data)).limit(1))[0];
  if (!existing) return { ok: false, code: "NOT_FOUND", message: "Rate not found." };
  await db.delete(shippingRates).where(eq(shippingRates.id, parsed.data));
  return { ok: true, data: { id: parsed.data } };
}

// --- Email log ---

export type AdminEmailRow = typeof emailLog.$inferSelect & { orderNumber: string | null };

export async function emailLogList(
  input?: unknown,
): Promise<ActionResult<{ items: AdminEmailRow[]; total: number; page: number; perPage: number }>> {
  const sp = await requireAdmin();
  if (!sp) return forbidden();
  const raw = (input ?? {}) as { orderNumber?: unknown; page?: unknown };
  const q = typeof raw.orderNumber === "string" ? raw.orderNumber.trim().slice(0, 40) : "";
  const page = parsePage(raw.page);
  const perPage = ADMIN_PAGE_SIZE;
  const offset = (page - 1) * perPage;

  let orderIds: string[] | null = null;
  if (q) {
    const like = `%${escapeLike(q)}%`;
    const matched = await db
      .select({ id: orders.id })
      .from(orders)
      .where(sql`${orders.number} ILIKE ${like}`)
      .limit(100);
    orderIds = matched.map((m) => m.id);
    if (orderIds.length === 0) {
      return { ok: true, data: { items: [], total: 0, page, perPage } };
    }
  }

  const whereClause = orderIds ? sql`${emailLog.orderId} IN (${sql.join(orderIds.map((id) => sql`${id}`), sql`, `)})` : undefined;
  const [rows, totalRows] = await Promise.all([
    db.select().from(emailLog).where(whereClause).orderBy(desc(emailLog.createdAt)).limit(perPage).offset(offset),
    db.select({ value: count() }).from(emailLog).where(whereClause),
  ]);
  const ids = [...new Set(rows.map((r) => r.orderId))];
  const orderRows =
    ids.length > 0
      ? await db.select({ id: orders.id, number: orders.number }).from(orders).where(sql`${orders.id} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`)
      : [];
  const byId = new Map(orderRows.map((o) => [o.id, o.number]));
  return {
    ok: true,
    data: {
      items: rows.map((r) => ({ ...r, orderNumber: byId.get(r.orderId) ?? null })),
      total: totalRows[0]?.value ?? 0,
      page,
      perPage,
    },
  };
}

export async function resendEmail(
  orderId: unknown,
  kind: unknown,
): Promise<ActionResult<{ orderId: string; kind: string }>> {
  const sp = await requireAdmin();
  if (!sp) return forbidden();
  const parsedId = z.string().uuid().safeParse(orderId);
  const parsedKind = z.enum(EMAIL_KINDS).safeParse(kind);
  if (!parsedId.success) return { ok: false, code: "INVALID_INPUT", message: "orderId must be a UUID." };
  if (!parsedKind.success) {
    return { ok: false, code: "INVALID_INPUT", message: "kind must be one of buyer_confirm | owner_fulfill | admin_digest." };
  }
  try {
    await resendFailed(parsedId.data, parsedKind.data);
    return { ok: true, data: { orderId: parsedId.data, kind: parsedKind.data } };
  } catch (e) {
    if (e instanceof NotifyError) {
      return { ok: false, code: e.code, message: e.message };
    }
    return { ok: false, code: "RESEND_FAILED", message: (e as Error)?.message ?? "Could not resend the email." };
  }
}

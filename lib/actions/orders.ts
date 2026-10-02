"use server";

import { count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  currencies,
  orderItems,
  orders,
  products,
  shippingZones,
} from "@/lib/db/schema";
import { getSessionProfile } from "@/lib/auth-session";
import { canTransition, isBuyerCancellable, type OrderStatus } from "@/lib/order-machine";
import type { ActionResult } from "./cart";

export type MyOrderDTO = {
  id: string;
  number: string;
  status: string;
  currencyCode: string;
  currencySymbol: string;
  fxRateSnapshot: string;
  subtotalBaseCents: number;
  shippingBaseCents: number;
  totalBaseCents: number;
  itemCount: number;
  createdAt: Date;
};

export async function getMyOrders(): Promise<ActionResult<MyOrderDTO[]>> {
  const sp = await getSessionProfile();
  if (!sp) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Sign in to see your orders." };
  }
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, sp.user.id))
    .orderBy(desc(orders.createdAt));

  const data: MyOrderDTO[] = [];
  for (const o of rows) {
    const [{ value: itemCount }] = await db
      .select({ value: count() })
      .from(orderItems)
      .where(eq(orderItems.orderId, o.id));
    data.push({
      id: o.id,
      number: o.number,
      status: o.status,
      currencyCode: o.currencyCode,
      currencySymbol: (
        await db.select().from(currencies).where(eq(currencies.code, o.currencyCode)).limit(1)
      )[0]?.symbol ?? o.currencyCode,
      fxRateSnapshot: o.fxRateSnapshot,
      subtotalBaseCents: o.subtotalBaseCents,
      shippingBaseCents: o.shippingBaseCents,
      totalBaseCents: o.totalBaseCents,
      itemCount,
      createdAt: o.createdAt,
    });
  }
  return { ok: true, data };
}

export type OrderDetailDTO = {
  order: typeof orders.$inferSelect;
  items: {
    productId: string;
    slug: string;
    name: string;
    image: string | null;
    qty: number;
    unitBaseCents: number;
  }[];
  zoneName: string | null;
  currency: typeof currencies.$inferSelect;
};

export async function getOrderDetail(
  id: unknown,
): Promise<ActionResult<OrderDetailDTO>> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: "Invalid order." };
  }
  const orderId = parsed.data;
  const sp = await getSessionProfile();
  if (!sp) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Sign in to see this order." };
  }
  const order = (
    await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  )[0];
  if (!order) {
    return { ok: false, code: "NOT_FOUND", message: "Order not found." };
  }
  const isOwner = order.userId === sp.user.id;
  const isAdmin = sp.profile.role === "admin";
  if (!isOwner && !isAdmin) {
    return { ok: false, code: "FORBIDDEN", message: "You cannot view this order." };
  }

  const lines = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  const items: OrderDetailDTO["items"] = [];
  for (const l of lines) {
    const p = (
      await db.select().from(products).where(eq(products.id, l.productId)).limit(1)
    )[0];
    items.push({
      productId: l.productId,
      slug: p?.slug ?? "",
      name: p?.name ?? "Removed product",
      image: p?.images[0]?.url ?? null,
      qty: l.qty,
      unitBaseCents: l.unitBaseCents,
    });
  }

  const zone = (
    await db
      .select()
      .from(shippingZones)
      .where(eq(shippingZones.id, order.address.zoneId))
      .limit(1)
  )[0];
  const currency = (
    await db.select().from(currencies).where(eq(currencies.code, order.currencyCode)).limit(1)
  )[0];
  if (!currency) {
    return { ok: false, code: "NOT_FOUND", message: "Order currency is no longer configured." };
  }

  return {
    ok: true,
    data: { order, items, zoneName: zone?.name ?? null, currency },
  };
}

/**
 * Shopper cancel — pending only, within BUYER_CANCEL_WINDOW_MS of placement.
 * Restocks lines (same compensate pattern as admin cancel, no db.transaction).
 */
export async function cancelOrder(
  id: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: "Invalid order." };
  }
  const sp = await getSessionProfile();
  if (!sp) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Sign in to cancel this order." };
  }
  const order = (
    await db.select().from(orders).where(eq(orders.id, parsed.data)).limit(1)
  )[0];
  if (!order || order.userId !== sp.user.id) {
    return { ok: false, code: "NOT_FOUND", message: "Order not found." };
  }
  if (!canTransition(order.status as OrderStatus, "cancelled")) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: "Only pending orders can be cancelled here — contact support for help.",
    };
  }
  if (!isBuyerCancellable(order.status, order.createdAt)) {
    return {
      ok: false,
      code: "WINDOW_EXPIRED",
      message: "The 12-hour free-cancel window has passed — contact support and we will help.",
    };
  }
  const lines = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  for (const l of lines) {
    await db.execute(
      sql`UPDATE products SET stock = stock + ${l.qty} WHERE id = ${l.productId}`,
    );
  }
  await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, order.id));
  return { ok: true, data: { id: order.id } };
}

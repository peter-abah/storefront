// Sole Drizzle schema — Better Auth tables (generated via
// `npx auth@latest generate --output lib/db/auth-schema.ts`) + app tables.
// One schema + one migration chain for local Docker AND Neon (same dialect).
// Money rule: integer base cents against the `currencies` row with
// is_base=true (resolved at runtime, never hardcoded).
export * from "./auth-schema";
export * from "./admin-auth-schema";

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";

// tsvector isn't exported by drizzle-orm/pg-core — define it locally.
// Column is maintained by a Postgres trigger (manual migration 0001),
// so inserts omit it and reads treat it as opaque text.
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// --- Profiles (app role on top of Better Auth user) ---
export const profiles = pgTable("profiles", {
  id: text("id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  role: text("role").default("customer").notNull(), // customer-only since ADR-021 (admin lives in admin_users); legacy 'admin' value never written
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Currencies (fully admin-driven; exactly one is_base=true) ---
// rateToBase = units of base currency per 1 unit of this currency
// (e.g. base NGN: NGN rate 1, USD rate 1500). Display = base / rate.
export const currencies = pgTable("currencies", {
  code: text("code").primaryKey(),
  symbol: text("symbol").notNull(),
  label: text("label").notNull(),
  rateToBase: numeric("rate_to_base").notNull(),
  isBase: boolean("is_base").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
});

// --- Shipping zones + rates (admin-driven) ---
export const shippingZones = pgTable("shipping_zones", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  active: boolean("active").default(true).notNull(),
});

export const shippingRates = pgTable(
  "shipping_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => shippingZones.id, { onDelete: "cascade" }),
    minSubtotalCents: integer("min_subtotal_cents").default(0).notNull(),
    feeCents: integer("fee_cents").notNull(),
    etaDays: text("eta_days").notNull(),
  },
  (t) => [index("rates_zone_min_idx").on(t.zoneId, t.minSubtotalCents)],
);

// --- Products (rich Home & Living attrs) ---
export const roomEnum = pgEnum("room", [
  "living",
  "bedroom",
  "dining",
  "bath",
  "decor",
  "outdoor",
]);

export const categoryEnum = pgEnum("category", [
  "furniture",
  "lighting",
  "textiles",
  "decor",
  "tableware",
]);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    tagline: text("tagline"),
    story: text("story"),
    priceBaseCents: integer("price_base_cents").notNull(),
    stock: integer("stock").default(0).notNull(),
    room: roomEnum("room").notNull(),
    category: categoryEnum("category").notNull(),
    materials: text("materials").array(),
    dimensions: jsonb("dimensions").$type<{
      w: number;
      d: number;
      h: number;
      unit: string;
    }>(),
    weightKg: numeric("weight_kg"),
    care: text("care"),
    images: jsonb("images")
      .$type<{ url: string; blurHash?: string }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    active: boolean("active").default(true).notNull(),
    featured: boolean("featured").default(false).notNull(),
    // Maintained by Postgres trigger (see manual migration 0001):
    // to_tsvector(name + tagline + story + materials).
    search: tsvector("search"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("products_filter_idx").on(t.active, t.room, t.category, t.priceBaseCents),
  ],
);

// --- Carts (logged users; guests use localStorage, merged on login) ---
export const carts = pgTable("carts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    qty: integer("qty").notNull(),
  },
  (t) => [uniqueIndex("cart_items_pk").on(t.cartId, t.productId)],
);

// --- Payment methods (admin toggle; COD on by default, Paystack off) ---
export const paymentMethods = pgTable("payment_methods", {
  code: text("code").primaryKey(), // cod | paystack
  enabled: boolean("enabled").default(true).notNull(),
  label: text("label").notNull(),
});

// --- Orders (COD + Paystack; totals frozen with FX snapshot) ---
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    number: text("number").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    email: text("email").notNull(),
    status: text("status").default("pending").notNull(), // pending|confirmed|out_for_delivery|delivered|paid_on_delivery|cancelled
    currencyCode: text("currency_code")
      .notNull()
      .references(() => currencies.code),
    fxRateSnapshot: numeric("fx_rate_snapshot").notNull(),
    subtotalBaseCents: integer("subtotal_base_cents").notNull(),
    shippingBaseCents: integer("shipping_base_cents").notNull(),
    totalBaseCents: integer("total_base_cents").notNull(),
    address: jsonb("address")
      .$type<{
        name: string;
        phone: string;
        country: string;
        state: string;
        city: string;
        street: string;
        postal: string;
        zoneId: string;
        notes?: string;
      }>()
      .notNull(),
    clientToken: text("client_token").notNull().unique(), // idempotency key
    paymentMethod: text("payment_method").default("cod").notNull(), // cod | paystack
    paymentStatus: text("payment_status").default("unpaid").notNull(), // unpaid | awaiting | paid | failed | refunded
    paystackRef: text("paystack_ref").unique(),
    paidAt: timestamp("paid_at"),
    paystackAuth: jsonb("paystack_auth").$type<{
      last4?: string;
      brand?: string;
      channel?: string;
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("orders_user_status_idx").on(t.userId, t.status, t.createdAt)],
);

export const orderItems = pgTable(
  "order_items",
  {
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    sellerId: text("seller_id"), // owner in V1 single-store; nullable for seed flexibility
    qty: integer("qty").notNull(),
    unitBaseCents: integer("unit_base_cents").notNull(), // price snapshot
  },
  (t) => [uniqueIndex("order_items_pk").on(t.orderId, t.productId)],
);

// --- Email log (source of truth for comms; Mailgun keeps 1 day only) ---
export const emailLog = pgTable(
  "email_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // buyer_confirm | owner_fulfill | admin_digest
    toEmail: text("to_email").notNull(),
    provider: text("provider").default("mailgun").notNull(),
    providerMsgId: text("provider_msg_id"),
    status: text("status").default("pending").notNull(), // pending | sent | failed
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    sentAt: timestamp("sent_at"),
  },
  (t) => [
    uniqueIndex("email_log_order_kind_idx").on(t.orderId, t.kind),
    index("email_log_status_idx").on(t.status),
  ],
);

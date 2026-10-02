import { cache } from "react";
import { and, asc, desc, eq, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { currencies, products } from "@/lib/db/schema";

export type Product = typeof products.$inferSelect;
export type Room = Product["room"];
export type Category = Product["category"];

export type ProductSort = "featured" | "newest" | "price_asc" | "price_desc";

export type ListProductsParams = {
  search?: string;
  room?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: ProductSort | string;
  page?: number;
  perPage?: number;
};

export type Currency = typeof currencies.$inferSelect;

const ROOMS: Room[] = ["living", "bedroom", "dining", "bath", "decor", "outdoor"];
const CATEGORIES: Category[] = ["furniture", "lighting", "textiles", "decor", "tableware"];
const SORTS: ProductSort[] = ["featured", "newest", "price_asc", "price_desc"];

function escapeLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function normalizeSort(sort?: string): ProductSort {
  return SORTS.includes(sort as ProductSort) ? (sort as ProductSort) : "featured";
}

function orderByFor(sort: ProductSort) {
  switch (sort) {
    case "newest":
      return [desc(products.createdAt)];
    case "price_asc":
      return [asc(products.priceBaseCents), desc(products.createdAt)];
    case "price_desc":
      return [desc(products.priceBaseCents), desc(products.createdAt)];
    case "featured":
    default:
      return [desc(products.featured), desc(products.createdAt)];
  }
}

/**
 * Server-only catalog queries (RSC + Server Actions). Memoized per request
 * via React `cache` so hero + listing + filters share one round-trip.
 */
export const listProducts = cache(
  async (params: ListProductsParams = {}): Promise<{ items: Product[]; total: number }> => {
    const {
      search,
      room,
      category,
      minPrice,
      maxPrice,
      inStock,
      sort: rawSort,
      page: rawPage,
      perPage: rawPerPage,
    } = params;

    const sort = normalizeSort(rawSort);
    const page = Math.max(1, Math.floor(Number(rawPage) || 1));
    const perPage = Math.min(100, Math.max(1, Math.floor(Number(rawPerPage) || 24)));
    const offset = (page - 1) * perPage;

    const conditions = [eq(products.active, true)];

    if (room && (ROOMS as string[]).includes(room)) {
      conditions.push(eq(products.room, room as Room));
    }
    if (category && (CATEGORIES as string[]).includes(category)) {
      conditions.push(eq(products.category, category as Category));
    }
    if (Number.isFinite(minPrice) && (minPrice as number) >= 0) {
      conditions.push(sql`${products.priceBaseCents} >= ${Math.floor(minPrice as number)}`);
    }
    if (Number.isFinite(maxPrice) && (maxPrice as number) >= 0) {
      conditions.push(sql`${products.priceBaseCents} <= ${Math.floor(maxPrice as number)}`);
    }
    if (inStock) {
      conditions.push(sql`${products.stock} > 0`);
    }

    const q = (search ?? "").trim();
    if (q.length > 0) {
      const like = `%${escapeLike(q)}%`;
      // Full-text when the query yields lexemes; ILIKE fallback when
      // plainto_tsquery produces an empty query (stopwords / punctuation).
      conditions.push(
        sql`(
          (plainto_tsquery('english', ${q})::text <> '' AND ${products.search} @@ plainto_tsquery('english', ${q}))
          OR (plainto_tsquery('english', ${q})::text = '' AND (
            ${products.name} ILIKE ${like}
            OR ${products.tagline} ILIKE ${like}
            OR ${products.story} ILIKE ${like}
            OR array_to_string(${products.materials}, ' ') ILIKE ${like}
          ))
        )`,
      );
    }

    const where = and(...conditions);
    const orderBy = orderByFor(sort);

    const [items, totalRows] = await Promise.all([
      db.select().from(products).where(where).orderBy(...orderBy).limit(perPage).offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(where),
    ]);

    return { items, total: totalRows[0]?.count ?? 0 };
  },
);

export const getProduct = cache(async (slug: string): Promise<Product | null> => {
  const s = (slug ?? "").trim();
  if (!s) return null;
  const rows = await db.select().from(products).where(eq(products.slug, s)).limit(1);
  return rows[0] ?? null;
});

export const getRelated = cache(
  async (product: Pick<Product, "id" | "room" | "category">, limit = 4): Promise<Product[]> => {
    const n = Math.min(12, Math.max(1, Math.floor(limit)));
    return db
      .select()
      .from(products)
      .where(
        and(
          eq(products.active, true),
          ne(products.id, product.id),
          or(eq(products.room, product.room), eq(products.category, product.category)),
        ),
      )
      .orderBy(desc(products.featured), desc(products.createdAt))
      .limit(n);
  },
);

export const getFilterMeta = cache(
  async (): Promise<{ rooms: Room[]; categories: Category[] }> => {
    const [roomRows, catRows] = await Promise.all([
      db
        .selectDistinct({ room: products.room })
        .from(products)
        .where(eq(products.active, true)),
      db
        .selectDistinct({ category: products.category })
        .from(products)
        .where(eq(products.active, true)),
    ]);
    const rooms = roomRows.map((r) => r.room).sort() as Room[];
    const categories = catRows.map((r) => r.category).sort() as Category[];
    return { rooms, categories };
  },
);

// --- Currency helpers (money rule: integer base cents, runtime base row) ---
// Pure converters live in lib/money.ts (client-safe); this module keeps the
// DB-backed currency lookup. Re-exported here so existing imports keep working.
export { toDisplay, formatDisplay } from "@/lib/money";
export type { MoneyCurrency } from "@/lib/money";

export const getDisplayCurrency = cache(async (code?: string): Promise<Currency> => {
  const rows = await db.select().from(currencies).where(eq(currencies.active, true));
  if (rows.length === 0) {
    // Base row must exist (seed guarantees one); fail loudly, never guess.
    const base = await db.select().from(currencies).where(eq(currencies.isBase, true)).limit(1);
    if (!base[0]) throw new Error("No currencies configured (expected one is_base row).");
    return base[0];
  }
  if (code) {
    const wanted = rows.find((c) => c.code.toLowerCase() === code.toLowerCase());
    if (wanted) return wanted;
  }
  return rows.find((c) => c.isBase) ?? rows[0]!;
});

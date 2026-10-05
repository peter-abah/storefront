import "./env.js";
import { readFileSync } from "node:fs";
import { count } from "drizzle-orm";
import { db, dbDriver } from "../lib/db";
import {
  adminUser,
  currencies,
  paymentMethods,
  products,
  shippingRates,
  shippingZones,
} from "../lib/db/schema";

function dbHost(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "(unparseable)";
  }
}

async function tryCount(label: string, fn: () => Promise<number>): Promise<number | null> {
  try {
    const n = await fn();
    console.log(`${label}: ${n}`);
    return n;
  } catch (e) {
    console.error(`${label}: query failed (${e instanceof Error ? e.message : e})`);
    return null;
  }
}

async function main() {
  // (a) Journal migrations (tags only, no SQL).
  try {
    const journal = JSON.parse(
      readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"),
    ) as { entries: { tag: string }[] };
    const tags = journal.entries.map((e) => e.tag);
    console.log(`migrations (${tags.length}): ${tags.join(", ")}`);
  } catch (e) {
    console.error(`journal: unreadable (${e instanceof Error ? e.message : e})`);
  }

  // (b) Which DB host (hostname only — never credentials or full URL).
  const raw = process.env.DATABASE_URL ?? "";
  if (!raw) {
    console.error("Missing DATABASE_URL (and DATABASE_URL_UNPOOLED is not a runtime fallback).");
    console.error("Hint: copy .env.example to .env.local, then run: pnpm db:setup");
    process.exit(1);
  }
  console.log(`host: ${dbHost()} (${dbDriver})`);

  // (c) Row counts. Defensive per query; a dead connection exits non-zero.
  let failed = false;
  const check = async (label: string, fn: () => Promise<number>) => {
    const n = await tryCount(label, fn);
    if (n === null) failed = true;
  };

  await check("products", async () => (await db.select({ n: count() }).from(products))[0]!.n);
  await check("currencies", async () => (await db.select({ n: count() }).from(currencies))[0]!.n);
  try {
    const rows = await db
      .select({ code: currencies.code, isBase: currencies.isBase, active: currencies.active })
      .from(currencies);
    for (const r of rows) console.log(`  - ${r.code} is_base=${r.isBase} active=${r.active}`);
  } catch (e) {
    console.error(`currencies detail: query failed (${e instanceof Error ? e.message : e})`);
    failed = true;
  }
  await check(
    "shipping_zones",
    async () => (await db.select({ n: count() }).from(shippingZones))[0]!.n,
  );
  await check(
    "shipping_rates",
    async () => (await db.select({ n: count() }).from(shippingRates))[0]!.n,
  );
  await check(
    "payment_methods",
    async () => (await db.select({ n: count() }).from(paymentMethods))[0]!.n,
  );
  await check("admin_users", async () => (await db.select({ n: count() }).from(adminUser))[0]!.n);

  if (failed) {
    console.error("Hint: check DATABASE_URL in .env.local, then run: pnpm db:setup");
    process.exit(1);
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    console.error("Hint: check DATABASE_URL in .env.local, then run: pnpm db:setup");
    process.exit(1);
  },
);

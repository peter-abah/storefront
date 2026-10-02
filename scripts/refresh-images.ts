// One-shot image refresh: recompute curated images per slug via the
// deterministic buildProductRows() and UPDATE in place — preserves
// orders, carts, stock, and active flags. Reusable when photography
// changes again (e.g. Cloudinary fetch-migration).
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { products } from "../lib/db/schema";
import { buildProductRows } from "./seed";

async function main() {
  const rows = buildProductRows();
  let updated = 0;
  for (const row of rows) {
    // .returning() so postgres-js reports affected rows (empty without it).
    // Bare .returning(): neon-http driver typings reject column args.
    const res = await db
      .update(products)
      .set({ images: row.images })
      .where(eq(products.slug, row.slug!))
      .returning();
    updated += res.length;
  }
  console.log(`refresh done: ${updated}/${rows.length} image sets updated`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);

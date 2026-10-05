// Seed: currencies (admin-driven, one is_base) + shipping zones/rates +
// ~150 Home & Living products. Idempotent (onConflictDoNothing).
// Photography: curated Unsplash furniture/home URLs mapped per category +
// room (all IDs HTTP-verified; ~30 spot-viewed for subject relevance).
// Short-term hotlink (images.unsplash.com in next.config remotePatterns);
// migrate to Cloudinary `fetch` when keys land — same URLs, no re-curation.
// NOTE: demo-grade stock photography, not the boutique's own inventory
// shots — final launch needs real product photography.
const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

const PHOTOS: Record<string, string[]> = {
  furniture: [
    "1555041469-a586c61ea9bc",
    "1586023492125-27b2c045efd7",
    "1592078615290-033ee584e267",
    "1503602642458-232111445657",
    "1519947486511-46149fa0a254",
    "1581539250439-c96689b516dd",
    "1549497538-303791108f95",
    "1598300042247-d088f8ab3a91",
    "1506439773649-6e0eb8cfb237",
  ],
  lighting: [
    "1507473885765-e6ed057f782c",
    "1513506003901-1e6a229e2d15",
    "1524484485831-a92ffc0de03f",
    "1565814329452-e1efa11c5b89",
    "1493663284031-b7e3aefcae8e",
  ],
  textiles: [
    "1522771739844-6a9f6d5f14af",
    "1540518614846-7eded433c457",
    "1595526114035-0d45ed16cfbf",
    "1578683010236-d716f9a3f461",
    "1590490360182-c33d57733427",
    "1600166898405-da9535204843",
    "1567016432779-094069958ea5",
  ],
  decor: [
    "1578500494198-246f612d3b3d",
    "1513519245088-0e12902e5a38",
    "1533090481720-856c6e3c1fdc",
    "1556228453-efd6c1ff04f6",
    "1485955900006-10f4d324d411",
    "1610701596007-11502861dcfa",
    "1578749556568-bc2c40e68b61",
  ],
  tableware: [
    "1556911220-bff31c812dba",
    "1484154218962-a197022b5858",
    "1519710164239-da123dc03ef4",
    "1524758631624-e2822e304c36",
    "1556909114-f6e7ad7d3136",
  ],
};

const ROOM_PHOTOS: Record<string, string[]> = {
  living: [
    "1522708323590-d24dbb6b0267",
    "1493809842364-78817add7ffb",
    "1616486338812-3dadae4b4ace",
    "1618221195710-dd6b41faaea6",
    "1618220179428-22790b461013",
    "1600607687939-ce8a6c25118c",
    "1600607687920-4e2a09cf159d",
    "1536376072261-38c75010e6c9",
  ],
  bedroom: [
    "1595526051245-4506e0005bd0",
    "1505693416388-ac5ce068fe85",
    "1616594039964-ae9021a400a0",
    "1615874959474-d609969a20ed",
    "1583847268964-b28dc8f51f92",
    "1618221118493-9cfa1a1c00da",
  ],
  dining: [
    "1519710164239-da123dc03ef4",
    "1484154218962-a197022b5858",
    "1556911220-bff31c812dba",
    "1536376072261-38c75010e6c9",
  ],
  bath: [
    "1584622650111-993a426fbf0a",
    "1552321554-5fefe8c9ef14",
    "1600566752355-35792bedcfea",
    "1600566753086-00f18fb6b3ea",
    "1600210492486-724fe5c67fb0",
  ],
  decor: [
    "1578500494198-246f612d3b3d",
    "1556228453-efd6c1ff04f6",
    "1485955900006-10f4d324d411",
    "1600166898405-da9535204843",
    "1513694203232-719a280e022f",
    "1533090481720-856c6e3c1fdc",
  ],
  outdoor: [
    "1485955900006-10f4d324d411",
    "1556228453-efd6c1ff04f6",
    "1513694203232-719a280e022f",
    "1578500494198-246f612d3b3d",
    "1600166898405-da9535204843",
  ],
};

function productImages(cat: string, room: string, n: number): { url: string }[] {
  const cp = PHOTOS[cat] ?? PHOTOS.decor!;
  const rp = ROOM_PHOTOS[room] ?? ROOM_PHOTOS.living!;
  const pick = (pool: string[], k: number) => pool[k % pool.length]!;
  return [{ url: U(pick(cp, n)) }, { url: U(pick(rp, n + 2)) }, { url: U(pick(cp, n + 5)) }];
}
import "./env.js";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { currencies, shippingZones, shippingRates, products, paymentMethods } from "../lib/db/schema";

const ROOMS = ["living", "bedroom", "dining", "bath", "decor", "outdoor"] as const;
const CATS = ["furniture", "lighting", "textiles", "decor", "tableware"] as const;

const NAMES: Record<string, string[]> = {
  furniture: ["Aso Lounge Chair", "Zuri Oak Coffee Table", "Kano Rattan Sofa", "Ife Walnut Bookshelf", "Sahara Daybed", "Benin Accent Bench"],
  lighting: ["Amber Pendant Light", "Sahel Floor Lamp", "Terracotta Table Lamp", "Brass Wall Sconce", "Woven Rattan Chandelier"],
  textiles: ["Adire Throw Pillow", "Aso-Oke Throw Blanket", "Linen Duvet Set", "Kilim Area Rug", "Mudcloth Curtain Panel"],
  decor: ["Benin Bronze Vase", "Terracotta Planter Trio", "Carved Iroko Mirror", "Woven Seagrass Basket", "Marble Incense Holder"],
  tableware: ["Stoneware Dinner Set", "Hammered Brass Tray", "Ceramic Tea Collection", "Olive Wood Serving Board", "Handblown Glass Carafe"],
};

const MATERIALS: Record<string, string[]> = {
  furniture: ["solid oak", "walnut veneer", "rattan", "boucle wool", "powder-coated steel"],
  lighting: ["brass", "opal glass", "terracotta", "woven rattan", "linen shade"],
  textiles: ["cotton", "linen", "wool", "aso-oke", "mudcloth"],
  decor: ["terracotta", "bronze", "iroko wood", "seagrass", "marble"],
  tableware: ["stoneware", "brass", "ceramic", "olive wood", "recycled glass"],
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function main() {
  // --- Payment methods: COD on by default, Paystack off until keys land. ---
  // Idempotent (onConflictDoNothing preserves admin toggles on re-runs).
  await db
    .insert(paymentMethods)
    .values([
      { code: "cod", enabled: true, label: "Cash on Delivery" },
      { code: "paystack", enabled: false, label: "Paystack" },
    ])
    .onConflictDoNothing();

  // --- Currencies: exactly one is_base. Code never names a code. ---
  await db
    .insert(currencies)
    .values([
      { code: "NGN", symbol: "₦", label: "Nigerian Naira", rateToBase: "1", isBase: true, active: true },
      { code: "USD", symbol: "$", label: "US Dollar", rateToBase: "1500", isBase: false, active: true },
      { code: "GHS", symbol: "₵", label: "Ghanaian Cedi", rateToBase: "100", isBase: false, active: false },
    ])
    .onConflictDoNothing();

  // --- Zones + rates (fees in BASE cents; admin-editable, no deploy) ---
  const zoneRows = [
    { name: "Lagos", rates: [{ min: 0, fee: 150000, eta: "1-2 days" }, { min: 5000000, fee: 0, eta: "1-2 days" }] },
    { name: "Nationwide", rates: [{ min: 0, fee: 350000, eta: "3-5 days" }, { min: 10000000, fee: 0, eta: "3-5 days" }] },
    { name: "International", rates: [{ min: 0, fee: 1500000, eta: "7-14 days" }] },
  ];
  for (const z of zoneRows) {
    const [zone] = await db
      .insert(shippingZones)
      .values({ name: z.name, active: true })
      .onConflictDoNothing({ target: shippingZones.name })
      .returning();
    const existing = await db
      .select({ id: shippingZones.id })
      .from(shippingZones)
      .where(eq(shippingZones.name, z.name));
    const zoneId = zone?.id ?? existing[0]!.id;
    const existingRates = await db
      .select({ id: shippingRates.id })
      .from(shippingRates)
      .where(eq(shippingRates.zoneId, zoneId));
    if (existingRates.length > 0) continue; // idempotent re-runs
    for (const r of z.rates) {
      await db.insert(shippingRates).values({
        zoneId,
        minSubtotalCents: r.min,
        feeCents: r.fee,
        etaDays: r.eta,
      });
    }
  }

  await seedProducts();
}

type ProductRow = typeof products.$inferInsert;

// Deterministic catalog builder — shared by seed (insert) and
// refresh-images (update in place, preserving orders/carts).
export function buildProductRows(): ProductRow[] {
  const rows: ProductRow[] = [];
  let n = 0;
  for (const cat of CATS) {
    for (const room of ROOMS) {
      for (const base of NAMES[cat]) {
        const name = `${base} · ${room[0].toUpperCase()}${room.slice(1)}`;
        const slug = slugify(`${name}-${++n}`);
        const mats = MATERIALS[cat]!;
        const priceBaseCents =
          (cat === "furniture" ? 45000 + ((n * 7919) % 180000) : 8000 + ((n * 7919) % 60000)) * 100;
        rows.push({
          slug,
          name,
          tagline: `Hand-finished ${cat} for the ${room} — ${mats[n % mats.length]}.`,
          story: `${name} is crafted in small batches from ${mats[n % mats.length]} and ${mats[(n + 1) % mats.length]}. Designed to age gracefully in real homes, not showrooms.`,
          priceBaseCents,
          stock: n % 11 === 0 ? 0 : 4 + ((n * 13) % 36),
          room,
          category: cat,
          materials: [mats[n % mats.length]!, mats[(n + 1) % mats.length]!],
          dimensions: { w: 40 + ((n * 7) % 120), d: 30 + ((n * 5) % 80), h: 25 + ((n * 11) % 150), unit: "cm" },
          weightKg: String(1 + ((n * 3) % 25)),
          care: "Wipe with a dry cloth. Keep out of prolonged direct sun.",
          images: productImages(cat, room, n),
          active: true,
          featured: n % 9 === 0,
        });
      }
    }
  }
  return rows;
}

async function seedProducts() {
  // --- Products: 5 categories x 5-6 names x 6 rooms ≈ 150 ---
  const rows = buildProductRows();
  for (const row of rows) {
    await db.insert(products).values(row).onConflictDoNothing({ target: products.slug });
  }
  console.log(`seed done: ${rows.length} products attempted`);
}

// Run only when executed directly (`pnpm dlx tsx scripts/seed.ts`);
// importable for buildProductRows() (see refresh-images.ts) without side effects.
const isDirect =
  !!process.argv[1] && /[/\\]seed\.ts$/.test(process.argv[1]);
if (isDirect) {
  main().then(
    () => process.exit(0),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}

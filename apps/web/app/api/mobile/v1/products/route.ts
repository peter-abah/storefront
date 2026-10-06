import type { PaginatedProductsDTO } from "@maison/shared";
import { productListQuerySchema } from "@maison/shared";
import { listProducts } from "@/lib/queries/products";
import { invalidInput, jsonOk, preflight } from "@/lib/mobile/api";
import { toProductCardDTO } from "@/lib/mobile/project";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * GET /api/mobile/v1/products?q&room&category&minPriceCents&maxPriceCents
 *   &inStock&sort&page — public catalog listing. Strict query validation:
 * bad enum/min values 400 instead of listProducts silently defaulting.
 */
export async function GET(req: Request) {
  const query = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = productListQuerySchema.safeParse(query);
  if (!parsed.success) {
    return invalidInput(req, parsed.error.issues[0]?.message);
  }
  const { q, room, category, minPriceCents, maxPriceCents, inStock, sort, page } =
    parsed.data;

  const result = await listProducts({
    search: q,
    room,
    category,
    minPrice: minPriceCents,
    maxPrice: maxPriceCents,
    inStock,
    sort,
    page,
  });

  const data: PaginatedProductsDTO = {
    items: result.items.map(toProductCardDTO),
    total: result.total,
  };
  return jsonOk(req, data);
}

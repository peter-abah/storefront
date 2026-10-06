import type { ProductDetailDTO, RelatedProductDTO } from "@maison/shared";
import { getProduct, getRelated } from "@/lib/queries/products";
import { jsonError, jsonOk, preflight } from "@/lib/mobile/api";
import { toProductCardDTO, toProductDTO } from "@/lib/mobile/project";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * GET /api/mobile/v1/products/[slug] — public product detail + related
 * cards (same anchors and limit as apps/web/app/product/[slug]/page.tsx:42-46).
 * Inactive products 404 like the page's notFound().
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product || !product.active) {
    return jsonError(req, "NOT_FOUND", "Product not found.", 404);
  }

  const related = await getRelated(product, 4);
  const data: {
    product: ProductDetailDTO;
    related: RelatedProductDTO[];
  } = {
    product: toProductDTO(product),
    related: related.map(toProductCardDTO),
  };
  return jsonOk(req, data);
}

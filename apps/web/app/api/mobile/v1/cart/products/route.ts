import type { GuestCartProductDTO } from "@maison/shared";
import { cartProductsSchema } from "@maison/shared";
import { getCartProducts } from "@/lib/actions/cart";
import { invalidInput, jsonOk, preflight, readJson } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * POST /api/mobile/v1/cart/products — public guest-cart product snapshots
 * (max 50 uuids). Malformed `{ ids }` bodies 400; unknown ids are simply
 * absent from the result.
 */
export async function POST(req: Request) {
  const raw = await readJson(req);
  if (!raw.ok) return invalidInput(req, "Malformed JSON body.");
  const parsed = cartProductsSchema.safeParse(raw.body);
  if (!parsed.success) {
    return invalidInput(req, parsed.error.issues[0]?.message);
  }
  const result = await getCartProducts(parsed.data.ids);
  const data: GuestCartProductDTO[] = [...result.data];
  return jsonOk(req, data);
}

import { cartLineSchema } from "@maison/shared";
import { addToCart } from "@/lib/actions/cart";
import { invalidInput, preflight, readJson, runAction } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * POST /api/mobile/v1/cart/items — add one line. Body validated with the
 * shared cartLineSchema at the route layer (bad shape 400 before auth).
 */
export async function POST(req: Request) {
  const raw = await readJson(req);
  if (!raw.ok) return invalidInput(req, "Malformed JSON body.");
  const parsed = cartLineSchema.safeParse(raw.body);
  if (!parsed.success) {
    return invalidInput(req, parsed.error.issues[0]?.message);
  }
  return runAction(req, await addToCart(parsed.data));
}

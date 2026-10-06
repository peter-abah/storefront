import { cartMergeBodySchema } from "@maison/shared";
import { mergeGuestCart } from "@/lib/actions/cart";
import { invalidInput, preflight, readJson, runAction } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * POST /api/mobile/v1/cart/merge — merge guest lines after sign-in.
 * Wire body `{ lines: cartLine[] }` (max 100), validated by the shared
 * cartMergeBodySchema/cartMergeSchema.
 */
export async function POST(req: Request) {
  const raw = await readJson(req);
  if (!raw.ok) return invalidInput(req, "Malformed JSON body.");
  const parsed = cartMergeBodySchema.safeParse(raw.body);
  if (!parsed.success) {
    return invalidInput(req, parsed.error.issues[0]?.message);
  }
  return runAction(req, await mergeGuestCart(parsed.data.lines));
}

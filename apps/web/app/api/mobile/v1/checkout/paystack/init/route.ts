import { checkoutSchema } from "@maison/shared";
import { initPaystackOrder } from "@/lib/actions/checkout";
import { invalidInput, preflight, readJson, runAction } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * POST /api/mobile/v1/checkout/paystack/init — create the awaiting-payment
 * order and return the kobo/reference/publicKey for the native pay sheet.
 * PRICE_CHANGED failures keep their old/new snapshot fields (409).
 */
export async function POST(req: Request) {
  const raw = await readJson(req);
  if (!raw.ok) return invalidInput(req, "Malformed JSON body.");
  const parsed = checkoutSchema.safeParse(raw.body);
  if (!parsed.success) {
    return invalidInput(req, parsed.error.issues[0]?.message);
  }
  return runAction(req, await initPaystackOrder(parsed.data));
}

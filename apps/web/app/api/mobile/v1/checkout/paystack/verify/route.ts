import { paystackVerifySchema } from "@maison/shared";
import { verifyPaystackOrder } from "@/lib/actions/checkout";
import { invalidInput, preflight, readJson, runAction } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * POST /api/mobile/v1/checkout/paystack/verify — confirm gateway money for
 * an order (idempotent by reference); 402 PAYMENT_FAILED / 409
 * AMOUNT_MISMATCH / 502 gateway errors map through fail().
 */
export async function POST(req: Request) {
  const raw = await readJson(req);
  if (!raw.ok) return invalidInput(req, "Malformed JSON body.");
  const parsed = paystackVerifySchema.safeParse(raw.body);
  if (!parsed.success) {
    return invalidInput(req, parsed.error.issues[0]?.message);
  }
  return runAction(req, await verifyPaystackOrder(parsed.data));
}

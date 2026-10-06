import { checkoutSchema } from "@maison/shared";
import { createOrder } from "@/lib/actions/checkout";
import { invalidInput, preflight, readJson, runAction } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * POST /api/mobile/v1/checkout/cod — place a cash-on-delivery order.
 * checkoutSchema's paymentMethod defaults to "cod"; a paystack body here is
 * rejected by createOrder with INVALID_INPUT (400).
 */
export async function POST(req: Request) {
  const raw = await readJson(req);
  if (!raw.ok) return invalidInput(req, "Malformed JSON body.");
  const parsed = checkoutSchema.safeParse(raw.body);
  if (!parsed.success) {
    return invalidInput(req, parsed.error.issues[0]?.message);
  }
  return runAction(req, await createOrder(parsed.data));
}

import { uuidSchema } from "@maison/shared";
import { cancelOrder } from "@/lib/actions/orders";
import { invalidInput, preflight, runAction } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * POST /api/mobile/v1/orders/[id]/cancel — buyer cancel inside the 12h
 * window. INVALID_TRANSITION / WINDOW_EXPIRED map to 409 via statusForCode.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return invalidInput(req, "Invalid order.");
  return runAction(req, await cancelOrder(parsed.data));
}

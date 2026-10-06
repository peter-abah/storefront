import { cartLineSchema, uuidSchema } from "@maison/shared";
import { removeLine, updateQty } from "@/lib/actions/cart";
import { invalidInput, preflight, readJson, runAction } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** PATCH /api/mobile/v1/cart/items/[productId] — set qty (1-99). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const raw = await readJson(req);
  if (!raw.ok) return invalidInput(req, "Malformed JSON body.");
  const qty = (raw.body as { qty?: unknown } | null)?.qty;
  const parsed = cartLineSchema.safeParse({ productId, qty });
  if (!parsed.success) {
    return invalidInput(req, parsed.error.issues[0]?.message);
  }
  return runAction(req, await updateQty(parsed.data));
}

/** DELETE /api/mobile/v1/cart/items/[productId] — remove one line. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const parsed = uuidSchema.safeParse(productId);
  if (!parsed.success) return invalidInput(req, "Invalid product.");
  return runAction(req, await removeLine(parsed.data));
}

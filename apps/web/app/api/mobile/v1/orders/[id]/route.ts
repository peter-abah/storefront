import { uuidSchema } from "@maison/shared";
import { getOrderDetail } from "@/lib/actions/orders";
import { fail, invalidInput, jsonError, jsonOk, preflight } from "@/lib/mobile/api";
import { toOrderDetailDTO } from "@/lib/mobile/project";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * GET /api/mobile/v1/orders/[id] — authenticated order detail. Not-found and
 * not-owned both return 404 so order ids never leak across accounts.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return invalidInput(req, "Invalid order.");

  const result = await getOrderDetail(parsed.data);
  if (!result.ok) {
    if (result.code === "NOT_FOUND" || result.code === "FORBIDDEN") {
      return jsonError(req, "NOT_FOUND", "Order not found.", 404);
    }
    return fail(req, result);
  }
  return jsonOk(req, toOrderDetailDTO(result.data));
}

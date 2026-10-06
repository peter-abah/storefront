import { getMyOrders } from "@/lib/actions/orders";
import { fail, jsonOk, preflight } from "@/lib/mobile/api";
import { toMyOrderDTO } from "@/lib/mobile/project";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** GET /api/mobile/v1/orders — authenticated order history (ISO dates). */
export async function GET(req: Request) {
  const result = await getMyOrders();
  if (!result.ok) return fail(req, result);
  return jsonOk(req, result.data.map(toMyOrderDTO));
}

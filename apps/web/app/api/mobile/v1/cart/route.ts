import { getCart } from "@/lib/actions/cart";
import { preflight, runAction } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** GET /api/mobile/v1/cart — authenticated cart with live stock clamps. */
export async function GET(req: Request) {
  return runAction(req, await getCart());
}

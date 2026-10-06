import type { FilterMetaDTO } from "@maison/shared";
import { getFilterMeta } from "@/lib/queries/products";
import { jsonOk, preflight } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** GET /api/mobile/v1/filters — public distinct room/category facets. */
export async function GET(req: Request) {
  const meta: FilterMetaDTO = await getFilterMeta();
  return jsonOk(req, meta);
}

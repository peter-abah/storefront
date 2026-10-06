import type { MobileProfileDTO } from "@maison/shared";
import { getSessionProfile } from "@/lib/auth-session";
import { jsonError, jsonOk, preflight } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** GET /api/mobile/v1/me — session profile (cookie or bearer token). */
export async function GET(req: Request) {
  const sp = await getSessionProfile();
  if (!sp) {
    return jsonError(req, "UNAUTHENTICATED", "Sign in to view your profile.", 401);
  }
  const data: MobileProfileDTO = {
    id: sp.user.id,
    name: sp.user.name ?? null,
    email: sp.user.email,
    image: sp.user.image ?? null,
  };
  return jsonOk(req, data);
}

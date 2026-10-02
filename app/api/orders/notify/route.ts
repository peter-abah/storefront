import { createHash, timingSafeEqual } from "node:crypto";
import { NotifyError, notifyOrder } from "@/lib/email/notify";

export const runtime = "nodejs";

function sha256(s: string): Buffer {
  return createHash("sha256").update(s, "utf8").digest();
}

/** Timing-safe Bearer check: compare sha256 hashes (fixed length). */
function authorized(req: Request): boolean {
  const secret = process.env.NOTIFY_SECRET ?? "";
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/.exec(header.trim());
  if (!m?.[1]) return false;
  const a = sha256(m[1]);
  const b = sha256(secret);
  // Same length always (sha256) — timingSafeEqual is safe here.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return Response.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
  }

  let orderId: unknown;
  try {
    const body = (await req.json()) as { orderId?: unknown };
    orderId = body?.orderId;
  } catch {
    return Response.json(
      { ok: false, code: "INVALID_INPUT", message: "Body must be JSON {orderId}." },
      { status: 400 },
    );
  }

  try {
    const result = await notifyOrder(orderId);
    // Minimal shape — never echo secrets/keys. providerMsgId + attempts
    // are observability, not secrets.
    return Response.json(
      {
        ok: true,
        orderId: result.orderId,
        results: result.results.map((r) => ({
          kind: r.kind,
          status: r.status,
          providerMsgId: r.providerMsgId ?? null,
          attempts: r.attempts,
        })),
      },
      { status: 200 },
    );
  } catch (e) {
    if (e instanceof NotifyError) {
      const status = e.status === 400 || e.status === 404 ? e.status : 500;
      return Response.json(
        { ok: false, code: e.code, message: e.message },
        { status },
      );
    }
    return Response.json(
      { ok: false, code: "NOTIFY_FAILED" },
      { status: 500 },
    );
  }
}

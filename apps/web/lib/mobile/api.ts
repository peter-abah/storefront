// Shared plumbing for /api/mobile/v1 route handlers.
//
// CORS posture: `Access-Control-Allow-Origin: *` with NO credentials header.
// Browser cookie auth cross-origin is intentionally unsupported; the native
// app sends cookies itself or an `Authorization: Bearer` token (better-auth
// bearer plugin), which CORS never blocks. `Vary: Origin` is set so shared
// caches key correctly if the wildcard is ever replaced by an allowlist.
//
// Every JSON response carries `Cache-Control: no-store` — several endpoints
// are session-scoped and the public ones are cheap live DB reads.
import type { ApiResult } from "@maison/shared";

/** Status code per action failure code (unknown codes are client errors). */
const STATUS_BY_CODE: Record<string, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
  INVALID_ZONE: 400,
  INVALID_CURRENCY: 400,
  NOT_FOUND: 404,
  OUT_OF_STOCK: 409,
  PRICE_CHANGED: 409,
  PAYSTACK_DISABLED: 409,
  PAYMENT_METHOD_MISMATCH: 409,
  EMPTY_CART: 409,
  INVALID_TRANSITION: 409,
  WINDOW_EXPIRED: 409,
  INVALID_STATE: 409,
  AMOUNT_MISMATCH: 409,
  PAYMENT_FAILED: 402,
  RATE_LIMITED: 429,
  ORDER_FAILED: 500,
  GATEWAY_ERROR: 502,
  GATEWAY_UNREACHABLE: 502,
  VERIFY_FAILED: 502,
  PAYSTACK_CONFIG: 502,
};

export function statusForCode(code: string): number {
  return STATUS_BY_CODE[code] ?? 400;
}

/** Any `{ ok: false, code, message }` action failure, extras preserved. */
export type ActionFailure = {
  ok: false;
  code: string;
  message: string;
} & Record<string, unknown>;

/** A route result: the action data on success, the raw failure otherwise. */
export type RouteResult<T> = { ok: true; data: T } | ActionFailure;

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

function jsonHeaders(): Record<string, string> {
  return {
    ...corsHeaders(),
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}

/** OPTIONS handler — assign as `export const OPTIONS = preflight` per route. */
export function preflight(req: Request): Response {
  void req; // Route-handler signature parity; preflight needs no request.
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export function jsonOk(req: Request, data: unknown, status = 200): Response {
  return Response.json({ ok: true, data } satisfies ApiResult<unknown>, {
    status,
    headers: jsonHeaders(),
  });
}

export function jsonError(
  req: Request,
  code: string,
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): Response {
  const body: ApiResult<never> = { ok: false, code, message, ...extra };
  return Response.json(body, { status, headers: jsonHeaders() });
}

export function invalidInput(req: Request, message?: string): Response {
  return jsonError(req, "INVALID_INPUT", message ?? "Invalid request.", 400);
}

/** Convert an action failure to the mapped HTTP status, preserving extras. */
export function fail(req: Request, result: ActionFailure): Response {
  const extra: Record<string, unknown> = { ...result };
  delete extra.ok;
  delete extra.code;
  delete extra.message;
  return jsonError(
    req,
    result.code,
    result.message,
    statusForCode(result.code),
    extra,
  );
}

/** Pass-through for an action result: 200 JSON or mapped failure. */
export function runAction<T>(req: Request, result: RouteResult<T>): Response {
  if (result.ok) return jsonOk(req, result.data);
  return fail(req, result);
}

/** Malformed JSON is a 400 — callers map it to INVALID_INPUT. */
export async function readJson(
  req: Request,
): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: false };
  }
}

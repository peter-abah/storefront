// In-memory fixed-window limiter for createOrder (10/min per key).
// Single-instance best-effort: serverless may run several instances, so
// this is abuse friction, not a hard guarantee — pricing/stock safety
// comes from server re-validation, never from this limiter.
const WINDOW_MS = 60_000;
const LIMIT = 10;

const hits = new Map<string, number[]>();

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const fresh = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (fresh.length >= LIMIT) {
    hits.set(key, fresh);
    return false;
  }
  fresh.push(now);
  hits.set(key, fresh);
  return true;
}

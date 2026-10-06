import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Guest cart in AsyncStorage — the device mirror of the web guest cart
 * (apps/web/lib/cart-local.ts): key `maison:guest-cart:v1`, lines
 * `{productId, qty}` with qty 1–99 and at most 100 lines, so the stored
 * shape is exactly what `cartMergeBodySchema` accepts on sign-in.
 */
export type GuestLine = { productId: string; qty: number };

export const GUEST_CART_KEY = "maison:guest-cart:v1";
export const MAX_GUEST_QTY = 99;
export const MAX_GUEST_LINES = 100;

export class GuestStorageError extends Error {
  readonly code = "STORAGE_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "GuestStorageError";
  }
}

const STORAGE_ERROR_MESSAGE =
  "Device storage is unavailable — your bag won't be saved on this device.";

function clampQty(qty: unknown, fallback = 1): number {
  const n = typeof qty === "number" && Number.isFinite(qty) ? qty : fallback;
  return Math.min(MAX_GUEST_QTY, Math.max(1, Math.floor(n)));
}

function sanitize(value: unknown): GuestLine[] {
  if (!Array.isArray(value)) return [];
  const clean: GuestLine[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as GuestLine).productId !== "string" ||
      (entry as GuestLine).productId.length === 0
    ) {
      continue;
    }
    const productId = (entry as GuestLine).productId;
    if (seen.has(productId)) continue;
    const rawQty = (entry as GuestLine).qty;
    if (!Number.isInteger(rawQty)) continue;
    seen.add(productId);
    clean.push({ productId, qty: clampQty(rawQty) });
    if (clean.length >= MAX_GUEST_LINES) break;
  }
  return clean;
}

/** Read errors degrade to an empty bag; the store is best-effort. */
export async function getGuestLines(): Promise<GuestLine[]> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    return sanitize(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

async function writeGuestLines(lines: GuestLine[]): Promise<GuestLine[]> {
  try {
    await AsyncStorage.setItem(GUEST_CART_KEY, JSON.stringify(lines));
    return lines;
  } catch {
    throw new GuestStorageError(STORAGE_ERROR_MESSAGE);
  }
}

export async function setGuestLines(lines: GuestLine[]): Promise<GuestLine[]> {
  return writeGuestLines(sanitize(lines));
}

export async function addGuestLine(
  productId: string,
  qty = 1,
): Promise<GuestLine[]> {
  const lines = await getGuestLines();
  const found = lines.find((l) => l.productId === productId);
  if (found) {
    found.qty = Math.min(MAX_GUEST_QTY, found.qty + clampQty(qty));
  } else {
    if (lines.length >= MAX_GUEST_LINES) return lines;
    lines.push({ productId, qty: clampQty(qty) });
  }
  return writeGuestLines(lines);
}

export async function updateGuestLine(
  productId: string,
  qty: number,
): Promise<GuestLine[]> {
  const lines = (await getGuestLines()).map((l) =>
    l.productId === productId ? { ...l, qty: clampQty(qty) } : l,
  );
  return writeGuestLines(lines);
}

export async function removeGuestLine(
  productId: string,
): Promise<GuestLine[]> {
  const lines = (await getGuestLines()).filter(
    (l) => l.productId !== productId,
  );
  return writeGuestLines(lines);
}

export async function clearGuestLines(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GUEST_CART_KEY);
  } catch {
    // Clearing is best-effort: a stale store just re-merges later.
  }
}

export async function guestLineCount(): Promise<number> {
  return (await getGuestLines()).reduce((n, l) => n + l.qty, 0);
}

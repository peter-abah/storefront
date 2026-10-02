// Guest cart in localStorage (PRD F5). Logged users use Neon
// carts/cart_items; on login CartMerge sums this into the DB cart
// (clamped to stock) and clears storage. SSR-safe: every helper
// no-ops outside the browser.
export type GuestLine = { productId: string; qty: number };

const KEY = "maison:guest-cart:v1";
const MAX_QTY = 99;

function read(): GuestLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const clean: GuestLine[] = [];
    for (const l of parsed) {
      if (
        typeof l === "object" &&
        l !== null &&
        typeof (l as GuestLine).productId === "string" &&
        Number.isInteger((l as GuestLine).qty)
      ) {
        const qty = Math.min(MAX_QTY, Math.max(1, (l as GuestLine).qty));
        clean.push({ productId: (l as GuestLine).productId, qty });
      }
    }
    return clean;
  } catch {
    return [];
  }
}

function write(lines: GuestLine[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // Storage full/blocked — guest cart simply doesn't persist.
  }
}

export function getGuestCart(): GuestLine[] {
  return read();
}

export function setGuestCart(lines: GuestLine[]): void {
  write(lines);
}

export function addGuestLine(productId: string, qty = 1): GuestLine[] {
  const lines = read();
  const found = lines.find((l) => l.productId === productId);
  if (found) {
    found.qty = Math.min(MAX_QTY, found.qty + Math.max(1, qty));
  } else {
    lines.push({ productId, qty: Math.min(MAX_QTY, Math.max(1, qty)) });
  }
  write(lines);
  return lines;
}

export function updateGuestQty(productId: string, qty: number): GuestLine[] {
  const lines = read()
    .map((l) =>
      l.productId === productId
        ? { ...l, qty: Math.min(MAX_QTY, Math.max(1, qty)) }
        : l,
    )
    .filter((l) => l.qty >= 1);
  write(lines);
  return lines;
}

export function removeGuestLine(productId: string): GuestLine[] {
  const lines = read().filter((l) => l.productId !== productId);
  write(lines);
  return lines;
}

export function clearGuestCart(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function guestCount(): number {
  return read().reduce((n, l) => n + l.qty, 0);
}

// Tiny client-safe event bus between cart islands (badge, drawer,
// product buttons, merge). Server state itself always comes from the
// cart Server Actions — these events only say "reload now".
export function openCartDrawer(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("maison:cart-open"));
}

export function notifyCartUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("maison:cart-updated"));
}

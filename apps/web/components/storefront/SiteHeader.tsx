import Link from "next/link";
import { CartBadge } from "@/components/cart/CartBadge";
import { AuthIsland } from "@/components/cart/AuthIsland";

const TICKER_ITEMS = [
  "Cash on delivery",
  "Solid timber, honest textiles",
  "Priced at today's rate — frozen on your order",
  "The rider calls before arrival",
  "Repairable finishes, not replaceable",
];

/**
 * Storefront header (Wave 4 + Phase 3 ticker). Static server shell —
 * brand + Shop nav — so the root layout stays prerender-friendly.
 * Session bits stay client islands. Ticker is transform-only CSS,
 * silenced by the global prefers-reduced-motion rule.
 */
export function SiteHeader() {
  const line = TICKER_ITEMS.join("  ·  ");
  return (
    <>
      <div
        aria-hidden
        className="overflow-hidden border-b border-ink/10 bg-ink py-1.5 text-cream"
      >
        <div className="animate-ticker flex w-max gap-0 whitespace-nowrap">
          {[0, 1].map((copy) => (
            <span
              key={copy}
              className="pr-8 text-[11px] tracking-[0.22em] uppercase"
            >
              {line} · {line}
            </span>
          ))}
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/90 backdrop-blur">
        <div className="editorial-grid items-center py-4">
          <div className="col-span-12 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href="/"
              className="font-display mr-auto text-xl tracking-tight sm:order-1 sm:text-2xl"
              aria-label="Maison — home"
            >
              Maison
              <span className="ml-2 align-middle text-[10px] tracking-[0.28em] uppercase text-bronze">
                Est. Lagos
              </span>
            </Link>
            <nav
              aria-label="Store"
              className="order-last flex w-full items-center gap-5 text-sm sm:order-2 sm:w-auto"
            >
              <Link href="/shop" className="text-ink-soft hover:text-bronze-deep">
                Shop
              </Link>
              <Link href="/orders" className="text-ink-soft hover:text-bronze-deep">
                Orders
              </Link>
              <Link href="/contact" className="text-ink-soft hover:text-bronze-deep">
                Contact
              </Link>
            </nav>
            <div className="flex items-center gap-2 sm:order-3 sm:gap-3">
              <AuthIsland />
              <CartBadge />
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

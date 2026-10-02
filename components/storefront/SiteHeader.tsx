import Link from "next/link";
import { CartBadge } from "@/components/cart/CartBadge";
import { AuthIsland } from "@/components/cart/AuthIsland";

/**
 * Storefront header (Wave 4). Static server shell — brand + Shop nav —
 * so the root layout stays prerender-friendly for the ISR catalog.
 * Session-dependent bits (cart count, sign-in) are client islands that
 * read fresh server state (Server Actions / useSession) on mount.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/90 backdrop-blur">
      <div className="editorial-grid items-center py-4">
        <div className="col-span-12 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href="/"
            className="font-display mr-auto text-xl tracking-tight sm:order-1 sm:text-2xl"
            aria-label="Maison — home"
          >
            Maison
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
  );
}

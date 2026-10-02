"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartMerge } from "@/components/cart/CartMerge";

/**
 * Storefront chrome wrapper — hides the storefront SiteHeader, SiteFooter
 * and CartDrawer on /admin routes so the admin shell stays minimal and
 * free of shopper navigation. CartMerge is also shopper-only.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = (pathname ?? "").startsWith("/admin");
  if (isAdmin) return <>{children}</>;
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
      <CartDrawer />
      <CartMerge />
    </>
  );
}

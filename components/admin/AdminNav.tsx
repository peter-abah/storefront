"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { adminAuthClient } from "@/lib/admin-auth-client";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/emails", label: "Emails" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOutAdmin() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // Admin-only signOut — isolated /api/admin-auth session.
      // Header AuthIsland keeps using shopper signOut (lib/auth-client).
      await adminAuthClient.signOut();
    } finally {
      setSigningOut(false);
      router.push("/admin/login");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="Admin sections" className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const active = isActive(pathname ?? "", t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-pill border px-4 py-1.5 text-sm transition-transform duration-200 hover:-translate-y-0.5 hover:text-ink ${
                active
                  ? "border-ink bg-ink text-cream"
                  : "border-ink/15 bg-paper text-ink-soft"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={signOutAdmin}
        disabled={signingOut}
        className="rounded-pill border border-ink/15 px-4 py-1.5 text-sm text-ink-soft hover:border-clay hover:text-clay disabled:opacity-50"
      >
        {signingOut ? "Signing out…" : "Admin sign out"}
      </button>
    </div>
  );
}

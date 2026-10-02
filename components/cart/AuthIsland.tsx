"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";

function AuthIslandInner() {
  const { data: session, isPending } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (isPending) {
    return (
      <span
        aria-hidden
        className="inline-block h-5 w-16 animate-pulse rounded bg-ink/10"
      />
    );
  }

  if (session?.user) {
    const first = (session.user.name ?? session.user.email ?? "Account")
      .split(" ")[0]
      ?.split("@")[0];
    return (
      <span className="flex items-center gap-3 text-sm">
        <Link href="/orders" className="text-ink-soft hover:text-bronze-deep">
          Hi, {first}
        </Link>
        <button
          type="button"
          onClick={() => signOut()}
          className="text-ink-mute underline-offset-4 hover:text-ink hover:underline"
        >
          Sign out
        </button>
      </span>
    );
  }

  // Preserve where the shopper was (path + search) so Google returns
  // them to context (/cart, /checkout, /orders/…?query) instead of /shop.
  const qs = searchParams?.toString();
  const full = `${pathname ?? ""}${qs ? `?${qs}` : ""}`;
  const loginHref =
    full && pathname !== "/login" && pathname?.startsWith("/")
      ? `/login?callbackURL=${encodeURIComponent(full)}`
      : "/login";

  return (
    <Link
      href={loginHref}
      className="rounded-pill border border-ink/20 px-4 py-1.5 text-sm hover:border-bronze"
    >
      Sign in
    </Link>
  );
}

export function AuthIsland() {
  return (
    <Suspense
      fallback={
        <Link
          href="/login"
          className="rounded-pill border border-ink/20 px-4 py-1.5 text-sm hover:border-bronze"
        >
          Sign in
        </Link>
      }
    >
      <AuthIslandInner />
    </Suspense>
  );
}

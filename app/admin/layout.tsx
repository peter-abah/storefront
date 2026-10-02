import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth-session";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/emails", label: "Emails" },
];

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sp = await getSessionProfile();
  if (!sp) redirect(`/login?callbackURL=${encodeURIComponent("/admin")}`);
  if (sp.profile.role !== "admin") {
    return (
      <main className="editorial-grid py-14">
        <div className="col-span-12 max-w-xl">
          <p className="text-xs tracking-[0.3em] uppercase text-bronze">403 · Admin only</p>
          <h1 className="font-display mt-2 text-4xl">Not authorized</h1>
          <p className="mt-4 leading-relaxed text-ink-soft">
            This area is for the shop team. You are signed in as{" "}
            <strong className="text-ink">{sp.user.email}</strong>, which does not have admin access.
          </p>
          <Link href="/shop" className="rounded-pill mt-6 inline-block bg-ink px-6 py-2.5 text-sm text-cream">
            Back to the catalog
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="pb-16">
      <div className="border-b border-ink/10 bg-cream">
        <div className="editorial-grid py-6">
          <div className="col-span-12 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs tracking-[0.3em] uppercase text-bronze">Shop team</p>
              <h1 className="font-display mt-1 text-3xl">Admin</h1>
            </div>
            <nav aria-label="Admin sections" className="flex flex-wrap items-center gap-2">
              {TABS.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="rounded-pill border border-ink/15 bg-paper px-4 py-1.5 text-sm text-ink-soft transition-transform duration-200 hover:-translate-y-0.5 hover:text-ink"
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

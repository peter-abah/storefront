import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth-session";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Isolated admin gate — reads adminAuth (admin.session_token) only.
  // No shopper getSessionProfile / profiles.role dependency.
  const admin = await getAdminSession();
  if (!admin)
    redirect(`/admin/login?callbackURL=${encodeURIComponent("/admin")}`);

  return (
    <div className="pb-16">
      <div className="border-b border-ink/10 bg-cream">
        <div className="editorial-grid py-6">
          <div className="col-span-12 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs tracking-[0.3em] uppercase text-bronze">
                Shop team
              </p>
              <h1 className="font-display mt-1 text-3xl">Admin</h1>
              <p className="mt-1 text-xs text-ink-mute">
                Signed in as {admin.user.email}
              </p>
            </div>
            <AdminNav />
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

import { count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { adminUser } from "@/lib/db/admin-auth-schema";
import { getAdminSession } from "@/lib/auth-session";
import { AdminLoginForm } from "./AdminLoginForm";
import { Folio } from "@/components/storefront/Editorial";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin sign in — Maison",
  description: "Shop-team sign in with email and password.",
};

function safeAdminCallback(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/admin";
  if (v === "/admin/login" || v.startsWith("/admin/login?") || v.startsWith("/admin/login/")) {
    return "/admin";
  }
  return v;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Already signed in as admin → skip the form.
  const existing = await getAdminSession();
  const sp = await searchParams;
  const callbackURL = safeAdminCallback(sp.callbackURL);
  if (existing) redirect(callbackURL);

  let total = 0;
  try {
    const rows = await db.select({ value: count() }).from(adminUser);
    total = rows[0]?.value ?? 0;
  } catch {
    // Migration not yet applied — treat as bootstrap so the owner can
    // create the first account once the table exists.
    total = 0;
  }
  const isBootstrap = total === 0;

  return (
    <main className="editorial-grid items-stretch py-14 md:py-20">
      <div className="col-span-12 md:col-span-6">
        <Folio index="00" label="Shop team — Sign in" />
        <h1 className="font-display mt-4 text-4xl leading-[1.02] tracking-tight md:text-6xl">
          Backstage,
          <br />
          <span className="text-ink-soft italic">not the shop floor.</span>
        </h1>
        <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">
          Admin sign-in is separate from shopper accounts — email and
          password only, no Google. Shoppers keep using{" "}
          <span className="font-medium text-ink">/login</span>.
        </p>
      </div>
      <div className="col-span-12 mt-10 md:col-span-5 md:col-start-8 md:mt-0">
        <p className="font-display text-center text-3xl">Maison · Admin</p>
        <h2 className="font-display mt-3 text-center text-2xl">
          {isBootstrap ? "Create the owner account" : "Sign in to admin"}
        </h2>
        <p className="mt-2 text-center text-sm text-ink-soft">
          Then back to <span className="font-medium text-ink">{callbackURL}</span>.
        </p>
        <div className="mt-6">
          <AdminLoginForm isBootstrap={isBootstrap} callbackURL={callbackURL} />
        </div>
      </div>
    </main>
  );
}

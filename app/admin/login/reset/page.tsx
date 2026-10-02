import Link from "next/link";
import { AdminResetForm } from "./AdminResetForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reset admin password — Maison",
  description: "Set a new admin password from a reset link.",
};

export default async function AdminResetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = sp.token;
  const token = Array.isArray(raw) ? raw[0] : raw;

  return (
    <main className="editorial-grid py-14">
      <div className="col-span-12 mx-auto w-full max-w-md">
        <p className="text-center text-xs tracking-[0.3em] uppercase text-bronze">
          Shop team
        </p>
        <h1 className="font-display mt-2 text-center text-3xl">
          Reset admin password
        </h1>
        {!token ? (
          <div className="mt-6 border-t-2 border-ink bg-cream p-8 text-center">
            <p className="text-sm text-ink-soft">
              This reset link is missing its token. Request a fresh one from{" "}
              <Link href="/admin/login" className="text-bronze-deep underline underline-offset-4">
                admin sign in
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="border-t-2 border-ink bg-cream p-8">
            <AdminResetForm token={token} />
          </div>
        )}
      </div>
    </main>
  );
}

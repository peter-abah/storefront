import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export const metadata = {
  title: "Sign in — Maison",
  description: "Sign in with Google to check out.",
};

function safeCallback(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/shop";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const callbackURL = safeCallback(sp.callbackURL);

  return (
    <main className="editorial-grid py-14 md:py-20">
      <div className="col-span-12 mx-auto w-full max-w-md rounded-lg border border-ink/10 bg-cream p-8 text-center">
        <p className="font-display text-3xl">Maison</p>
        <h1 className="font-display mt-3 text-2xl">Sign in to Maison</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Sign in with Google to check out cash on delivery and track your
          orders. Browsing is always open — sign in only to check out.
        </p>
        <div className="mt-6">
          <GoogleSignInButton callbackURL={callbackURL} />
        </div>
        <p className="mt-4 text-xs text-ink-mute">
          Continue with Google — secure, no password needed.
        </p>
      </div>
    </main>
  );
}

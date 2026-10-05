import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Folio, MotifMark } from "@/components/storefront/Editorial";

export const metadata = {
  title: "Sign in — Maison",
  description: "Sign in with Google to check out.",
};

function safeCallback(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/shop";
  // Reject /login self-redirects — they loop back instead of landing.
  if (
    v === "/login" ||
    v.startsWith("/login?") ||
    v.startsWith("/login/") ||
    v.startsWith("/login#")
  ) {
    return "/shop";
  }
  return v;
}

const PROMISES = [
  ["01", "Track every order", "Confirmation, dispatch and the rider's call — all in one ledger."],
  ["02", "Faster checkout", "Your details carry over; cash still moves only at your door."],
  ["03", "Browsing stays open", "Sign in only to check out. The catalog never locks."],
] as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const callbackURL = safeCallback(sp.callbackURL);

  return (
    <main className="editorial-grid items-stretch py-14 md:py-20">
      {/* Left — editorial promise */}
      <div className="col-span-12 md:col-span-6 lg:col-span-6">
        <Folio index="07" label="Account — Sign in" />
        <h1 className="font-display mt-4 text-4xl leading-[1.02] tracking-tight md:text-6xl">
          Good rooms<br />
          <span className="text-ink-soft italic">take time.</span>
        </h1>
        <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">
          Sign in with Google to check out cash on delivery and track your
          orders.
        </p>
        <dl className="mt-8 border-t border-ink/10">
          {PROMISES.map(([n, t, d]) => (
            <div key={n} className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-ink/10 py-4">
              <dt className="sr-only">{t}</dt>
              <span aria-hidden className="text-[11px] tracking-[0.2em] text-bronze">{n}</span>
              <span>
                <span className="font-display block text-lg">{t}</span>
                <span className="mt-0.5 block text-sm text-ink-soft">{d}</span>
              </span>
            </div>
          ))}
        </dl>
        <p className="mt-6 flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-ink-mute">
          <MotifMark className="h-4 w-4 text-bronze" />
          Secure · No password · Cash on delivery
        </p>
      </div>

      {/* Right — sign-in card (logic unchanged) */}
      <div className="col-span-12 mt-10 md:col-span-5 md:col-start-8 md:mt-0">
        <div className="border-t-2 border-ink bg-cream p-8 text-center md:sticky md:top-24">
          <p className="font-display text-3xl">Maison</p>
          <h2 className="font-display mt-3 text-2xl">Sign in to Maison</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            One tap with Google — then back to
            <span className="font-medium text-ink"> {callbackURL}</span>.
          </p>
          <div className="mt-6">
            <GoogleSignInButton callbackURL={callbackURL} />
          </div>
          <p className="mt-4 text-xs text-ink-mute">
            Continue with Google — secure, no password needed.
          </p>
        </div>
      </div>
    </main>
  );
}

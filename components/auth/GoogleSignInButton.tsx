"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";

export function GoogleSignInButton({ callbackURL }: { callbackURL: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setPending(true);
    setError(null);
    try {
      await signIn.social({ provider: "google", callbackURL });
    } catch {
      setError("Could not start Google sign-in — try again.");
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className="rounded-pill w-full bg-ink px-6 py-3 text-sm text-cream transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-50"
      >
        {pending ? "Connecting to Google…" : "Continue with Google"}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-center text-sm text-clay">
          {error}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { adminAuthClient } from "@/lib/admin-auth-client";

type Mode = "sign-in" | "sign-up" | "forgot";

export function AdminLoginForm({
  isBootstrap,
  callbackURL,
}: {
  isBootstrap: boolean;
  callbackURL: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(isBootstrap ? "sign-up" : "sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await adminAuthClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (res.error) {
        setError(res.error.message ?? "Could not sign in — check email and password.");
        return;
      }
      router.push(callbackURL);
      router.refresh();
    } catch {
      setError("Could not sign in — try again in a minute.");
    } finally {
      setPending(false);
    }
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await adminAuthClient.signUp.email({
        email: email.trim(),
        password,
        name: name.trim() || "Owner",
        callbackURL,
      });
      if (res.error) {
        // Bootstrap gate rejects with a generic error once an admin exists.
        setError(res.error.message ?? "Could not create the owner account.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Could not create the owner account — try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const r = await fetch("/api/admin-auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          redirectTo: "/admin/login/reset",
        }),
      });
      if (!r.ok) {
        setError("Could not send the reset link — try again in a minute.");
        return;
      }
      setNotice(
        "If this email belongs to an admin, a reset link is on its way. Check the server log in dev.",
      );
    } catch {
      setError("Could not send the reset link — try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-t-2 border-ink bg-cream p-8">
      {isBootstrap ? (
        <p className="rounded-md bg-bronze/10 p-3 text-sm text-ink">
          No admins yet — create the owner account. Further admins are added
          by the owner, never by public sign-up.
        </p>
      ) : null}

      <div className="mt-4 flex gap-2 text-sm">
        {!isBootstrap ? (
          <>
            <button
              type="button"
              onClick={() => setMode("sign-in")}
              aria-pressed={mode === "sign-in"}
              className={`rounded-pill border px-4 py-1.5 ${mode === "sign-in" ? "border-ink bg-ink text-cream" : "border-ink/15 text-ink-soft"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("forgot")}
              aria-pressed={mode === "forgot"}
              className={`rounded-pill border px-4 py-1.5 ${mode === "forgot" ? "border-ink bg-ink text-cream" : "border-ink/15 text-ink-soft"}`}
            >
              Reset password
            </button>
          </>
        ) : (
          <p className="text-sm text-ink-soft">Owner bootstrap — email + password.</p>
        )}
      </div>

      {mode === "forgot" ? (
        <form onSubmit={handleForgot} className="mt-6 flex flex-col gap-3 text-left">
          <label className="text-sm">
            Admin email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink/20 bg-paper px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-pill bg-ink px-6 py-2.5 text-sm text-cream disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send reset link"}
          </button>
          <button
            type="button"
            onClick={() => setMode("sign-in")}
            className="text-sm text-bronze-deep underline underline-offset-4"
          >
            Back to sign in
          </button>
        </form>
      ) : mode === "sign-up" ? (
        <form onSubmit={handleSignUp} className="mt-6 flex flex-col gap-3 text-left">
          <label className="text-sm">
            Display name
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Owner"
              className="mt-1 w-full rounded-md border border-ink/20 bg-paper px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Admin email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink/20 bg-paper px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Password (8+ characters)
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink/20 bg-paper px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-pill bg-ink px-6 py-2.5 text-sm text-cream disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create owner account"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSignIn} className="mt-6 flex flex-col gap-3 text-left">
          <label className="text-sm">
            Admin email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink/20 bg-paper px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink/20 bg-paper px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-pill bg-ink px-6 py-2.5 text-sm text-cream disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in to admin"}
          </button>
          <button
            type="button"
            onClick={() => setMode("forgot")}
            className="text-sm text-bronze-deep underline underline-offset-4"
          >
            Forgot password? Get a reset link
          </button>
        </form>
      )}

      {error ? (
        <p role="alert" className="mt-4 text-sm text-clay">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-4 text-sm text-ink-soft">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

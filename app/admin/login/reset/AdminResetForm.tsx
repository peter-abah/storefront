"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AdminResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const r = await fetch("/api/admin-auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password, token }),
      });
      const j = (await r.json().catch(() => null)) as {
        code?: string;
        message?: string;
      } | null;
      if (!r.ok) {
        setError(j?.message ?? "Reset link is invalid or expired — request a new one.");
        return;
      }
      router.push("/admin/login?callbackURL=%2Fadmin");
      router.refresh();
    } catch {
      setError("Could not reset the password — try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-3 text-left">
      <label className="text-sm">
        New password (8+ characters)
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
        {pending ? "Saving…" : "Set new password"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-clay">
          {error}
        </p>
      ) : null}
    </form>
  );
}

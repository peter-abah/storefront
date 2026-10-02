"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setPaymentMethodEnabled, type AdminPaymentMethod } from "@/lib/actions/admin";

export function PaymentMethodForm({ methods }: { methods: AdminPaymentMethod[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(code: string, next: boolean) {
    setError(null);
    setPending(code);
    try {
      const res = await setPaymentMethodEnabled(code, next);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  if (methods.length === 0) {
    return (
      <p role="status" className="rounded-lg border border-dashed border-ink/20 bg-cream p-4 text-sm text-ink-soft">
        No payment methods configured yet — checkout stays cash-on-delivery until the migration seeds them.
      </p>
    );
  }

  return (
    <div>
      <ul className="flex flex-col gap-3">
        {methods.map((m) => (
          <li
            key={m.code}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink/10 bg-cream p-4"
          >
            <div>
              <p className="font-medium">
                {m.code === "paystack" ? "Paystack (pay now)" : m.label}
              </p>
              <p className="mt-0.5 text-xs text-ink-mute">
                {m.code === "paystack"
                  ? "Cards, transfers and USSD — needs PAYSTACK_SECRET_KEY + public key env."
                  : "Cash or transfer when the rider arrives."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={m.enabled}
              aria-label={`${m.code} payments ${m.enabled ? "on" : "off"}`}
              disabled={pending === m.code}
              onClick={() => toggle(m.code, !m.enabled)}
              className={`rounded-pill px-4 py-1.5 text-sm transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-50 ${
                m.enabled ? "bg-moss text-cream" : "border border-ink/15 text-ink-soft"
              }`}
            >
              {pending === m.code ? "Saving…" : m.enabled ? "On" : "Off"}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs leading-relaxed text-ink-mute">
        Checkout reads this live — turning a method off hides it instantly. At least one stays on.
      </p>
      {error ? (
        <p role="alert" className="mt-3 rounded-md bg-clay/10 p-3 text-sm text-clay">
          {error}
        </p>
      ) : null}
    </div>
  );
}

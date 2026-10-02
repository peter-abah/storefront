"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelOrder } from "@/lib/actions/orders";

/** Shopper cancel button — pending orders within the 12h window only. */
export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCancel() {
    if (
      !window.confirm(
        "Cancel this order? Stock returns to the shelf and nothing is charged.",
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await cancelOrder(orderId);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="rounded-pill border border-ink/20 px-5 py-2.5 text-sm text-ink transition-colors hover:border-clay hover:text-clay disabled:opacity-50"
      >
        {pending ? "Cancelling…" : "Cancel this order"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-clay">
          {error}
        </p>
      ) : null}
    </div>
  );
}

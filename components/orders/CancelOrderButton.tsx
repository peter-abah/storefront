"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelOrder } from "@/lib/actions/orders";

/** Shopper cancel button — pending orders within the 12h window only. */
export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement as HTMLButtonElement : null;
    const t = window.setTimeout(() => confirmRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const els = [...dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      )].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (els.length === 0) return;
      const first = els[0]!;
      const last = els[els.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      openerRef.current?.focus?.();
      openerRef.current = null;
    };
  }, [open ]);

  async function onConfirm() {
    setPending(true);
    setError(null);
    try {
      const res = await cancelOrder(orderId);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={pending}
        className="rounded-pill border border-ink/20 px-5 py-2.5 text-sm text-ink transition-colors hover:border-clay hover:text-clay disabled:opacity-50"
      >
        Cancel this order
      </button>
      {error && !open ? (
        <p role="alert" className="mt-2 text-xs text-clay">
          {error}
        </p>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close cancel dialog"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-order-h"
            aria-describedby="cancel-order-d"
            className="relative w-full max-w-md rounded-lg border border-ink/10 bg-paper p-5 shadow-lift"
          >
            <h2 id="cancel-order-h" className="font-display text-xl">
              Cancel this order?
            </h2>
            <p id="cancel-order-d" className="mt-2 text-sm leading-relaxed text-ink-soft">
              Stock returns to the shelf and nothing is charged. This cannot be
              undone — the order stays in your history as cancelled.
            </p>
            {error ? (
              <p role="alert" className="mt-3 rounded-md bg-clay/10 p-3 text-sm text-clay">
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-pill border border-ink/20 px-5 py-2.5 text-sm disabled:opacity-50"
              >
                Keep my order
              </button>
              <button
                type="button"
                ref={confirmRef}
                onClick={onConfirm}
                disabled={pending}
                className="rounded-pill bg-clay px-5 py-2.5 text-sm text-cream disabled:opacity-50"
              >
                {pending ? "Cancelling…" : "Yes, cancel order"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

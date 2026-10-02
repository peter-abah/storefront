"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resendEmail, type AdminEmailRow } from "@/lib/actions/admin";

type Props = {
  logs: AdminEmailRow[];
  total: number;
  page: number;
  perPage: number;
  orderNumber: string;
};

function pill(status: string): string {
  if (status === "sent") return "bg-moss/15 text-moss";
  if (status === "failed") return "bg-clay/15 text-clay";
  return "bg-bronze/15 text-bronze-deep";
}

export function EmailLogTable({ logs, total, page, perPage, orderNumber }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState(orderNumber);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applyFilter(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (filter.trim()) params.set("order", filter.trim());
    if (page > 1 && !filter.trim()) params.set("page", String(1));
    const qs = params.toString();
    router.push(`/admin/emails${qs ? `?${qs}` : ""}`);
  }

  function goto(nextPage: number) {
    const params = new URLSearchParams();
    if (orderNumber) params.set("order", orderNumber);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    router.push(`/admin/emails${qs ? `?${qs}` : ""}`);
  }

  async function resend(orderId: string, kind: string) {
    setBusy(`${orderId}:${kind}`);
    setError(null);
    try {
      const res = await resendEmail(orderId, kind);
      if (!res.ok) setError(res.message);
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const pages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div>
      <form onSubmit={applyFilter} className="flex max-w-md flex-col gap-2 sm:flex-row" role="search" aria-label="Filter by order number">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by order number (e.g. MS-…)"
          className="w-full rounded-md border border-ink/20 bg-cream px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-pill shrink-0 bg-ink px-5 py-2 text-sm text-cream">
          Filter
        </button>
      </form>

      {logs.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-bronze/50 bg-cream px-6 py-12 text-center">
          <h2 className="font-display text-xl">No emails here yet.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            {orderNumber
              ? `Nothing logged for “${orderNumber}” yet — check the number or clear the filter to see the latest sends.`
              : "Each order sends three emails. When a send fails, Resend appears beside it."}
          </p>
          {orderNumber ? (
            <button type="button" onClick={() => { setFilter(""); router.push("/admin/emails"); }} className="rounded-pill mt-4 border border-ink/15 px-4 py-1.5 text-sm">
              Clear filter
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-ink/10 bg-cream">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink-mute">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tries</th>
                <th className="px-4 py-3">Error</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-3 font-medium">{l.orderNumber ?? l.orderId.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-ink-soft">{l.kind}</td>
                  <td className="px-4 py-3 text-ink-soft">{l.toEmail}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-pill inline-block px-3 py-1 text-xs ${pill(l.status)}`}>{l.status}</span>
                  </td>
                  <td className="px-4 py-3">{l.attempts}</td>
                  <td className="max-w-56 truncate px-4 py-3 text-xs text-ink-mute" title={l.lastError ?? ""}>{l.lastError ?? "—"}</td>
                  <td className="px-4 py-3">
                    {l.status === "failed" ? (
                      <button
                        type="button"
                        disabled={busy === `${l.orderId}:${l.kind}`}
                        onClick={() => resend(l.orderId, l.kind)}
                        className="rounded-pill bg-ink px-3 py-1 text-xs text-cream transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-50"
                      >
                        {busy === `${l.orderId}:${l.kind}` ? "Sending…" : "Resend"}
                      </button>
                    ) : (
                      <span className="text-xs text-ink-mute">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error ? <p role="alert" className="mt-3 text-sm text-clay">{error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
        <p>Page {page} of {pages} · {total} rows</p>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => goto(page - 1)} className="rounded-pill border border-ink/15 px-4 py-1.5 disabled:opacity-50">← Prev</button>
          <button type="button" disabled={page >= pages} onClick={() => goto(page + 1)} className="rounded-pill border border-ink/15 px-4 py-1.5 disabled:opacity-50">Next →</button>
        </div>
      </div>
    </div>
  );
}

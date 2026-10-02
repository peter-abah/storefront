"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setBaseCurrency, upsertCurrency } from "@/lib/actions/admin";

type Currency = {
  code: string;
  symbol: string;
  label: string;
  rateToBase: string;
  isBase: boolean;
  active: boolean;
};

const inputCls =
  "w-full rounded-md border border-ink/20 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink-mute focus:border-bronze focus:outline-none";
const labelCls = "mb-1 block text-xs tracking-wide uppercase text-ink-mute";

export function CurrencyForm({ currencies }: { currencies: Currency[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ code: "", symbol: "", label: "", rateToBase: "", active: true, isBase: false });
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startEdit(c: Currency) {
    setEditing(c.code);
    setForm({ code: c.code, symbol: c.symbol, label: c.label, rateToBase: c.rateToBase, active: c.active, isBase: c.isBase });
    setError(null);
  }

  function reset() {
    setEditing(null);
    setForm({ code: "", symbol: "", label: "", rateToBase: "", active: true, isBase: false });
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await upsertCurrency(form);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      reset();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function makeBase(code: string) {
    setError(null);
    const res = await setBaseCurrency(code);
    if (!res.ok) setError(res.message);
    else router.refresh();
  }

  return (
    <div>
      {currencies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-bronze/50 bg-cream px-6 py-10 text-center">
          <h3 className="font-display text-xl">No currencies yet.</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            Add your first currency and mark it as base — prices follow that currency at checkout.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ink/10 bg-cream">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink-mute">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Symbol · Label</th>
                <th className="px-4 py-3">Rate to base currency</th>
                <th className="px-4 py-3">Flags</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currencies.map((c) => (
                <tr key={c.code} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-3 font-medium">{c.code}</td>
                  <td className="px-4 py-3 text-ink-soft">{c.symbol} · {c.label}</td>
                  <td className="px-4 py-3">{c.rateToBase}</td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1 text-xs">
                      {c.isBase ? <span className="rounded-pill bg-bronze/15 px-2 py-0.5 text-bronze-deep">Base</span> : null}
                      {c.active ? <span className="rounded-pill bg-moss/15 px-2 py-0.5 text-moss">active</span> : <span className="rounded-pill bg-ink/10 px-2 py-0.5 text-ink-mute">off</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => startEdit(c)} className="rounded-pill border border-ink/15 px-3 py-1 text-xs">Edit</button>
                      {!c.isBase && c.active ? (
                        <button type="button" onClick={() => makeBase(c.code)} className="rounded-pill border border-bronze/40 px-3 py-1 text-xs text-bronze-deep">Make base</button>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={submit} className="mt-6 grid grid-cols-1 gap-4 rounded-lg border border-ink/10 bg-cream p-5 sm:grid-cols-2" noValidate>
        <h3 className="font-display text-xl sm:col-span-2">{editing ? `Edit ${editing}` : "Add a currency"}</h3>
        <label className="block">
          <span className={labelCls}>Code (3 letters) *</span>
          <input className={inputCls} value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="NGN" maxLength={3} disabled={Boolean(editing)} />
        </label>
        <label className="block">
          <span className={labelCls}>Symbol *</span>
          <input className={inputCls} value={form.symbol} onChange={(e) => set("symbol", e.target.value)} placeholder="₦" />
        </label>
        <label className="block sm:col-span-2">
          <span className={labelCls}>Label *</span>
          <input className={inputCls} value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="Nigerian Naira" />
        </label>
        <label className="block">
          <span className={labelCls}>Rate to base currency (&gt; 0) *</span>
          <input className={inputCls} value={form.rateToBase} onChange={(e) => set("rateToBase", e.target.value)} inputMode="decimal" placeholder="1" />
        </label>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Active
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.isBase} onChange={(e) => set("isBase", e.target.checked)} /> Base currency
          </label>
        </div>
        <p className="text-xs leading-relaxed text-ink-mute sm:col-span-2">
          The final active currency stays on, and the base stays until you choose a new one. Past orders never change.
        </p>
        {error ? <p role="alert" className="rounded-md bg-clay/10 p-3 text-sm text-clay sm:col-span-2">{error}</p> : null}
        <div className="flex justify-end gap-2 sm:col-span-2">
          {editing ? (
            <button type="button" onClick={reset} className="rounded-pill border border-ink/15 px-5 py-2 text-sm">Cancel</button>
          ) : null}
          <button type="submit" disabled={pending} className="rounded-pill bg-ink px-5 py-2 text-sm text-cream disabled:opacity-50">
            {pending ? "Saving…" : editing ? "Save currency" : "Add currency"}
          </button>
        </div>
      </form>
    </div>
  );
}

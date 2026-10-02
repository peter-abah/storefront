"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteRate, upsertRate, upsertZone, type AdminZone } from "@/lib/actions/admin";
import { useSmoothScroll } from "@/components/providers/smooth-scroll-provider";

const inputCls =
  "w-full rounded-md border border-ink/20 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink-mute focus:border-bronze focus:outline-none";
const labelCls = "mb-1 block text-xs tracking-wide uppercase text-ink-mute";

export function ZoneForm({ zones }: { zones: AdminZone[] }) {
  const router = useRouter();
  const [zoneName, setZoneName] = useState("");
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [zonePending, setZonePending] = useState(false);

  const [rate, setRate] = useState({ id: "", zoneId: "", minSubtotalCents: "", feeCents: "", etaDays: "" });
  const [rateError, setRateError] = useState<string | null>(null);
  const [ratePending, setRatePending] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<null | {
    id: string;
    zoneName: string;
    isLast: boolean;
    label: string;
  }>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteConfirmRef = useRef<HTMLButtonElement | null>(null);
  const deleteDialogRef = useRef<HTMLDivElement | null>(null);
  const deleteOpenerRef = useRef<HTMLElement | null>(null);
  const { stop: stopScroll, start: startScroll } = useSmoothScroll();

  useEffect(() => {
    if (!pendingDelete) return;
    deleteOpenerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    stopScroll();
    const t = window.setTimeout(() => deleteConfirmRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setPendingDelete(null);
        return;
      }
      if (e.key !== "Tab" || !deleteDialogRef.current) return;
      const els = [
        ...deleteDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null || el === document.activeElement);
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
      startScroll();
      deleteOpenerRef.current?.focus?.();
      deleteOpenerRef.current = null;
    };
  }, [pendingDelete, stopScroll, startScroll]);

  async function submitZone(e: React.FormEvent) {
    e.preventDefault();
    setZoneError(null);
    setZonePending(true);
    try {
      const res = await upsertZone({ name: zoneName });
      if (!res.ok) {
        setZoneError(res.message);
        return;
      }
      setZoneName("");
      router.refresh();
    } finally {
      setZonePending(false);
    }
  }

  function editRate(zoneId: string, r?: { id: string; minSubtotalCents: number; feeCents: number; etaDays: string }) {
    if (!r) {
      setRate({ id: "", zoneId, minSubtotalCents: "", feeCents: "", etaDays: "" });
    } else {
      setRate({ id: r.id, zoneId, minSubtotalCents: String(r.minSubtotalCents), feeCents: String(r.feeCents), etaDays: r.etaDays });
    }
    setRateError(null);
  }

  async function submitRate(e: React.FormEvent) {
    e.preventDefault();
    setRateError(null);
    setRatePending(true);
    try {
      const payload = {
        ...(rate.id ? { id: rate.id } : {}),
        zoneId: rate.zoneId,
        minSubtotalCents: Number(rate.minSubtotalCents),
        feeCents: Number(rate.feeCents),
        etaDays: rate.etaDays,
      };
      const res = await upsertRate(payload);
      if (!res.ok) {
        setRateError(res.message);
        return;
      }
      setRate({ id: "", zoneId: "", minSubtotalCents: "", feeCents: "", etaDays: "" });
      router.refresh();
    } finally {
      setRatePending(false);
    }
  }

  function requestRemoveRate(rateId: string) {
    setRateError(null);
    const zone = zones.find((z) => z.rates.some((r) => r.id === rateId));
    const found = zone?.rates.find((r) => r.id === rateId);
    const label = found
      ? `Over ${(found.minSubtotalCents / 100).toLocaleString("en")} → fee ${(found.feeCents / 100).toLocaleString("en")} · ${found.etaDays}`
      : "This rate";
    setPendingDelete({
      id: rateId,
      zoneName: zone?.name ?? "this zone",
      isLast: (zone?.rates.length ?? 0) <= 1,
      label,
    });
  }

  async function confirmRemoveRate() {
    if (!pendingDelete) return;
    setDeleting(true);
    setRateError(null);
    try {
      const res = await deleteRate(pendingDelete.id);
      if (!res.ok) {
        setRateError(res.message);
        return;
      }
      setPendingDelete(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  if (zones.length === 0) {
    return (
      <div>
        <div className="rounded-lg border border-dashed border-bronze/50 bg-cream px-6 py-10 text-center">
          <h3 className="font-display text-xl">No delivery zones yet.</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            Create your first area below (e.g. Lagos), then add rates — a zero fee means complimentary delivery over
            that amount.
          </p>
        </div>
        <ZoneCreate zoneName={zoneName} setZoneName={setZoneName} zoneError={zoneError} zonePending={zonePending} onSubmit={submitZone} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {zones.map((z) => (
        <section key={z.id} className="rounded-lg border border-ink/10 bg-cream p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-xl">{z.name}</h3>
            <span className={`rounded-pill px-3 py-1 text-xs ${z.active ? "bg-moss/15 text-moss" : "bg-ink/10 text-ink-mute"}`}>
              {z.active ? "Active" : "Hidden"}
            </span>
          </div>
          {z.rates.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">
              No rates for {z.name} yet — checkout will refuse this zone until you add at least one rate below.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {z.rates.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-ink/10 bg-paper px-3 py-2">
                  <span>
                    Over {(r.minSubtotalCents / 100).toLocaleString("en")} → fee {(r.feeCents / 100).toLocaleString("en")} · {r.etaDays}
                  </span>
                  <span className="flex gap-2">
                    <button type="button" onClick={() => editRate(z.id, r)} aria-haspopup="dialog" aria-expanded={rate.zoneId === z.id} aria-controls="rate-editor" className="rounded-pill border border-ink/15 px-3 py-1 text-xs">Edit</button>
                    <button type="button" onClick={() => requestRemoveRate(r.id)} aria-haspopup="dialog" aria-expanded={!!pendingDelete} aria-controls="delete-rate-dialog" className="rounded-pill border border-clay/40 px-3 py-1 text-xs text-clay">Delete</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => editRate(z.id)}
            aria-haspopup="dialog"
            aria-expanded={rate.zoneId === z.id}
            aria-controls="rate-editor"
            className="rounded-pill mt-3 border border-ink/15 px-4 py-1.5 text-sm transition-transform duration-200 hover:-translate-y-0.5"
          >
            + Rate for {z.name}
          </button>
        </section>
      ))}

      <ZoneCreate zoneName={zoneName} setZoneName={setZoneName} zoneError={zoneError} zonePending={zonePending} onSubmit={submitZone} />

      {rate.zoneId ? (
        <form onSubmit={submitRate} id="rate-editor" className="grid grid-cols-1 gap-4 rounded-lg border border-bronze/40 bg-cream p-5 sm:grid-cols-2" noValidate>
          <h3 className="font-display text-xl sm:col-span-2">{rate.id ? "Edit rate" : "New rate"}</h3>
          <label className="block">
            <span className={labelCls}>From order value (smallest unit, ≥ 0) *</span>
            <input className={inputCls} value={rate.minSubtotalCents} onChange={(e) => setRate((r) => ({ ...r, minSubtotalCents: e.target.value }))} inputMode="numeric" placeholder="0" />
          </label>
          <label className="block">
            <span className={labelCls}>Delivery fee (smallest unit, ≥ 0) *</span>
            <input className={inputCls} value={rate.feeCents} onChange={(e) => setRate((r) => ({ ...r, feeCents: e.target.value }))} inputMode="numeric" placeholder="150000" />
          </label>
          <label className="block sm:col-span-2">
            <span className={labelCls}>ETA (e.g. 1-2 days) *</span>
            <input className={inputCls} value={rate.etaDays} onChange={(e) => setRate((r) => ({ ...r, etaDays: e.target.value }))} placeholder="1-2 days" />
          </label>
          {rateError ? <p role="alert" className="rounded-md bg-clay/10 p-3 text-sm text-clay sm:col-span-2">{rateError}</p> : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setRate((r) => ({ ...r, zoneId: "" }))} className="rounded-pill border border-ink/15 px-5 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={ratePending} className="rounded-pill bg-ink px-5 py-2 text-sm text-cream disabled:opacity-50">
              {ratePending ? "Saving…" : rate.id ? "Save rate" : "Add rate"}
            </button>
          </div>
        </form>
      ) : null}
      {rateError && !rate.zoneId ? <p role="alert" className="text-sm text-clay">{rateError}</p> : null}
      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
          <button
            type="button"
            aria-label="Close delete confirmation"
            onClick={() => setPendingDelete(null)}
            className="absolute inset-0 bg-ink/40"
          />
          <div
            ref={deleteDialogRef}
            id="delete-rate-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-rate-h"
            aria-describedby="delete-rate-d"
            data-lenis-prevent
            className="relative my-auto max-h-[90vh] max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-lg border border-ink/10 bg-paper p-5 shadow-lift"
          >
            <h2 id="delete-rate-h" className="font-display text-xl">
              Delete rate in {pendingDelete.zoneName}?
            </h2>
            <div id="delete-rate-d" className="mt-2 text-sm leading-relaxed text-ink-soft">
              <p>{pendingDelete.label}.</p>
              {pendingDelete.isLast ? (
                <p role="alert" className="mt-2 rounded-md bg-clay/10 p-3 text-sm text-clay">
                  This is the last rate in {pendingDelete.zoneName} — deleting it will make checkout
                  refuse this zone until you add a new rate. Add a replacement first if you can.
                </p>
              ) : (
                <p className="mt-2 text-xs text-ink-mute">
                  Checkout will fall back to the remaining rates in {pendingDelete.zoneName}.
                </p>
              )}
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="rounded-pill border border-ink/20 px-5 py-2 text-sm disabled:opacity-50"
              >
                Keep rate
              </button>
              <button
                type="button"
                ref={deleteConfirmRef}
                onClick={confirmRemoveRate}
                disabled={deleting}
                className="rounded-pill bg-clay px-5 py-2 text-sm text-cream disabled:opacity-50"
              >
                {deleting ? "Deleting…" : pendingDelete.isLast ? "Delete last rate" : "Yes, delete rate"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ZoneCreate({
  zoneName,
  setZoneName,
  zoneError,
  zonePending,
  onSubmit,
}: {
  zoneName: string;
  setZoneName: (v: string) => void;
  zoneError: string | null;
  zonePending: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-ink/10 bg-cream p-5" noValidate>
      <h3 className="font-display text-xl">New zone</h3>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block w-full">
          <span className={labelCls}>Zone name (unique) *</span>
          <input className={inputCls} value={zoneName} onChange={(e) => setZoneName(e.target.value)} placeholder="Lagos" />
        </label>
        <button type="submit" disabled={zonePending} className="rounded-pill shrink-0 bg-ink px-5 py-2 text-sm text-cream disabled:opacity-50">
          {zonePending ? "Saving…" : "Add zone"}
        </button>
      </div>
      {zoneError ? <p role="alert" className="mt-3 rounded-md bg-clay/10 p-3 text-sm text-clay">{zoneError}</p> : null}
    </form>
  );
}

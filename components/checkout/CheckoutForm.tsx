"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createOrder, initPaystackOrder, verifyPaystackOrder } from "@/lib/actions/checkout";
import { checkoutSchema } from "@/lib/validations";
import { formatDisplay, toDisplay } from "@/lib/money";
import { PAYSTACK_CURRENCY, PAYSTACK_INLINE_JS, formatKobo } from "@/lib/paystack";
import { notifyCartUpdated } from "@/lib/cart-events";

declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: {
        key: string;
        email: string;
        amount: number;
        ref: string;
        currency: string;
        callback: (resp: { reference: string }) => void;
        onClose: () => void;
      }) => { openIframe: () => void };
    };
  }
}

let paystackScriptPromise: Promise<void> | null = null;

function loadPaystackInline(): Promise<void> {
  if (typeof window !== "undefined" && window.PaystackPop) return Promise.resolve();
  if (!paystackScriptPromise) {
    paystackScriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = PAYSTACK_INLINE_JS;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        paystackScriptPromise = null;
        reject(new Error("Could not load the Paystack popup — check your connection and try again."));
      };
      document.head.appendChild(s);
    });
  }
  return paystackScriptPromise;
}

type Zone = {
  id: string;
  name: string;
  rates: { minSubtotalCents: number; feeCents: number; etaDays: string }[];
};

type CurrencyOpt = {
  code: string;
  symbol: string;
  label: string;
  rateToBase: string;
  isBase: boolean;
};

type Line = {
  productId: string;
  name: string;
  image: string | null;
  qty: number;
  unitBaseCents: number;
  lineBaseCents: number;
};

type PaymentMethodOpt = {
  code: string;
  label: string;
  enabled: boolean;
};

type Props = {
  email: string;
  name: string;
  zones: Zone[];
  currencies: CurrencyOpt[];
  defaultCurrencyCode: string;
  lines: Line[];
  subtotalBaseCents: number;
  paymentMethods: PaymentMethodOpt[];
  paystackPublicKey: string;
};

type PriceSnapshot = {
  subtotalBaseCents: number;
  shippingBaseCents: number;
  totalBaseCents: number;
  currencyCode: string;
  rateToBase: string;
};

const DRAFT_KEY = "checkout-draft-v1";

function feeFor(zone: Zone | undefined, subtotal: number): { fee: number; eta: string | null } {
  if (!zone || zone.rates.length === 0) return { fee: 0, eta: null };
  const sorted = [...zone.rates].sort((a, b) => a.minSubtotalCents - b.minSubtotalCents);
  let fee = sorted[0]!.feeCents;
  let eta: string | null = sorted[0]!.etaDays;
  for (const r of sorted) {
    if (subtotal >= r.minSubtotalCents) {
      fee = r.feeCents;
      eta = r.etaDays;
    }
  }
  return { fee, eta };
}

function newToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function readDraftToken(): string {
  if (typeof window === "undefined") return newToken();
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (raw) {
      const d = JSON.parse(raw) as { clientToken?: unknown };
      if (typeof d.clientToken === "string" && d.clientToken.length >= 8) return d.clientToken;
    }
  } catch {
    // Corrupt or unavailable storage — fresh token.
  }
  return newToken();
}

const inputCls =
  "w-full rounded-md border border-ink/20 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink-mute focus:border-bronze focus:outline-none";

export function CheckoutForm({
  email,
  name,
  zones,
  currencies,
  defaultCurrencyCode,
  lines,
  subtotalBaseCents,
  paymentMethods,
  paystackPublicKey,
}: Props) {
  const router = useRouter();
  const enabledMethods = useMemo(
    () => paymentMethods.filter((m) => m.enabled),
    [paymentMethods],
  );
  // Single live method skips the choice; default to it.
  const defaultMethod =
    enabledMethods.length === 1 && enabledMethods[0]!.code === "paystack"
      ? "paystack"
      : "cod";
  const [form, setForm] = useState({
    name,
    phone: "",
    country: "",
    state: "",
    city: "",
    street: "",
    postal: "",
    zoneId: "",
    notes: "",
    currencyCode: defaultCurrencyCode,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [pending, setPending] = useState(false);
  const [payPhase, setPayPhase] = useState<"idle" | "starting" | "popup" | "verifying">("idle");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "paystack">(defaultMethod);
  const [clientToken, setClientToken] = useState<string>(readDraftToken);
  const [hydrated, setHydrated] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [drift, setDrift] = useState<{ old: PriceSnapshot; new: PriceSnapshot } | null>(null);
  const confirmDialogRef = useRef<HTMLDivElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmOpenerRef = useRef<HTMLElement | null>(null);
  // Ref mirror so the modal Escape guard never goes stale mid-payment.
  const payPhaseRef = useRef(payPhase);
  payPhaseRef.current = payPhase;

  // Confirm modal a11y: Escape close (unless placing), Tab trap,
  // initial focus on confirm, return focus to opener (mirrors CancelOrderButton).
  useEffect(() => {
    if (!showConfirm) return;
    confirmOpenerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const t = window.setTimeout(() => confirmButtonRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Keep the modal up while the Paystack popup/verify is in flight —
        // closing it strands the payment result.
        if (payPhaseRef.current !== "idle") return;
        e.preventDefault();
        setShowConfirm(false);
        return;
      }
      if (e.key !== "Tab" || !confirmDialogRef.current) return;
      const els = [
        ...confirmDialogRef.current.querySelectorAll<HTMLElement>(
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
      confirmOpenerRef.current?.focus?.();
      confirmOpenerRef.current = null;
    };
  }, [showConfirm]);

  // Restore draft saved before navigating to Terms/Shipping/Returns/orders.
  // Runs client-only after hydration so server HTML never mismatches.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<typeof form> & { clientToken?: unknown };
        setForm((f) => {
          const next = { ...f };
          if (typeof d.name === "string") next.name = d.name;
          if (typeof d.phone === "string") next.phone = d.phone;
          if (typeof d.country === "string") next.country = d.country;
          if (typeof d.state === "string") next.state = d.state;
          if (typeof d.city === "string") next.city = d.city;
          if (typeof d.street === "string") next.street = d.street;
          if (typeof d.postal === "string") next.postal = d.postal;
          if (typeof d.notes === "string") next.notes = d.notes;
          if (typeof d.zoneId === "string" && zones.some((z) => z.id === d.zoneId)) {
            next.zoneId = d.zoneId;
          }
          if (
            typeof d.currencyCode === "string" &&
            currencies.some((c) => c.code === d.currencyCode)
          ) {
            next.currencyCode = d.currencyCode;
          }
          return next;
        });
        if (typeof d.clientToken === "string" && d.clientToken.length >= 8) {
          setClientToken(d.clientToken);
        }
      }
    } catch {
      // Corrupt draft — keep defaults.
    } finally {
      setHydrated(true);
    }
    // Restore once on mount; zones/currencies are page-load constants.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist draft so policy/order links never wipe it.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, clientToken }));
    } catch {
      // Storage full or blocked — checkout still works, draft just won't persist.
    }
  }, [form, clientToken, hydrated]);

  const zone = useMemo(
    () => zones.find((z) => z.id === form.zoneId),
    [zones, form.zoneId],
  );
  const currency = useMemo(
    () => currencies.find((c) => c.code === form.currencyCode) ?? currencies[0]!,
    [currencies, form.currencyCode],
  );
  const { fee, eta } = useMemo(
    () => feeFor(zone, subtotalBaseCents),
    [zone, subtotalBaseCents],
  );
  const hasZone = !!zone && form.zoneId.length > 0;

  // After a PRICE_CHANGED round-trip, the server snapshot becomes the
  // honest figure shown everywhere until the shopper edits zone/currency.
  const shownSubtotal = drift?.new.subtotalBaseCents ?? subtotalBaseCents;
  const shownFee = drift?.new.shippingBaseCents ?? fee;
  const shownTotal = drift?.new.totalBaseCents ?? subtotalBaseCents + fee;
  const shownRate = drift?.new.rateToBase ?? currency.rateToBase;

  const price = (baseCents: number) =>
    formatDisplay(toDisplay(baseCents, shownRate), currency);

  const priceWith = (baseCents: number, rate: string | number, code: string, symbol: string) =>
    formatDisplay(toDisplay(baseCents, rate), { code, symbol });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    // Zone/currency edits invalidate the last server re-price.
    if (key === "zoneId" || key === "currencyCode") setDrift(null);
    setFieldErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  // Idempotency is scoped by (clientToken, paymentMethod): a token minted
  // for one method never satisfies the other. Switching methods mints a
  // fresh token and clears the stored draft so the stale token can't be
  // reused cross-method (server rejects it with PAYMENT_METHOD_MISMATCH).
  function switchMethod(next: "cod" | "paystack") {
    if (next === paymentMethod) return;
    setPaymentMethod(next);
    setClientToken(newToken());
    setDrift(null);
    try {
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Storage unavailable — the fresh token still applies to the next submit.
    }
  }

  // Server rejected a cross-method token reuse — mint fresh so the retry
  // sends an unused token, and drop the stale draft entry.
  function rotateTokenAfterMismatch() {
    setClientToken(newToken());
    try {
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Best effort — the fresh token still applies to the next submit.
    }
  }

  function buildPayload() {
    return {
      address: {
        name: form.name,
        phone: form.phone,
        country: form.country,
        state: form.state,
        city: form.city,
        street: form.street,
        postal: form.postal,
        zoneId: form.zoneId,
        notes: form.notes.trim() ? form.notes : undefined,
      },
      currencyCode: form.currencyCode,
      clientToken,
      zoneId: form.zoneId,
      paymentMethod,
      expectedSubtotalBaseCents: shownSubtotal,
      expectedShippingBaseCents: shownFee,
      expectedTotalBaseCents: shownTotal,
      expectedRateToBase: String(shownRate),
    };
  }

  function openConfirm(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setModalError(null);
    setSessionExpired(false);

    const payload = buildPayload();
    const check = checkoutSchema.safeParse(payload);
    if (!check.success) {
      const errs: Record<string, string> = {};
      for (const issue of check.error.issues) {
        const path = issue.path.join(".").replace(/^address\./, "");
        if (!errs[path]) errs[path] = issue.message;
      }
      setFieldErrors(errs);
      setFormError("Check the highlighted fields and try again.");
      return;
    }
    setShowConfirm(true);
  }

  function finishSuccess(orderId: string, idempotent?: boolean) {
    try {
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Best effort — navigation proceeds regardless.
    }
    notifyCartUpdated();
    if (idempotent) {
      // Same token already placed this order — show it as already
      // placed instead of a fresh ?new=1 thank-you.
      router.push(`/orders/${orderId}`);
    } else {
      router.push(`/orders/${orderId}?new=1`);
    }
  }

  async function runPaystackPopup(init: {
    orderId: string;
    reference: string;
    kobo: number;
  }) {
    if (!paystackPublicKey) {
      setModalError("Online payment is not configured yet — choose cash on delivery instead.");
      setPending(false);
      setPayPhase("idle");
      return;
    }
    try {
      await loadPaystackInline();
    } catch (e) {
      setModalError((e as Error)?.message ?? "Could not load the Paystack popup.");
      setPending(false);
      setPayPhase("idle");
      return;
    }
    if (!window.PaystackPop) {
      setModalError("Could not load the Paystack popup — check your connection and try again.");
      setPending(false);
      setPayPhase("idle");
      return;
    }
    setPayPhase("popup");
    try {
      window.PaystackPop.setup({
        key: paystackPublicKey,
        email,
        amount: init.kobo,
        ref: init.reference,
        currency: PAYSTACK_CURRENCY,
        callback: (resp) => {
          void (async () => {
            setPayPhase("verifying");
            try {
              const res = await verifyPaystackOrder({
                orderId: init.orderId,
                reference: resp?.reference ?? init.reference,
              });
              if (!res.ok) {
                setModalError(res.message);
                setFormError(res.message);
                setPending(false);
                setPayPhase("idle");
                return;
              }
              finishSuccess(res.data.orderId, res.data.idempotent);
            } catch {
              setModalError("Could not confirm the payment — check your orders page before retrying.");
              setPending(false);
              setPayPhase("idle");
            }
          })();
        },
        onClose: () => {
          // Popup closed before callback: verify may still complete via
          // webhook, so point at the order rather than blind retry.
          setModalError(
            "Payment window closed — no confirmation yet. If money left your account, your order will confirm automatically; otherwise try again.",
          );
          setPending(false);
          setPayPhase("idle");
        },
      }).openIframe();
    } catch {
      setModalError("Could not open the Paystack popup — try again.");
      setPending(false);
      setPayPhase("idle");
    }
  }

  async function confirmPlaceOrder() {
    const payload = buildPayload();
    const check = checkoutSchema.safeParse(payload);
    if (!check.success) {
      const errs: Record<string, string> = {};
      for (const issue of check.error.issues) {
        const path = issue.path.join(".").replace(/^address\./, "");
        if (!errs[path]) errs[path] = issue.message;
      }
      setFieldErrors(errs);
      setModalError("Check the highlighted fields and try again.");
      setShowConfirm(false);
      setFormError("Check the highlighted fields and try again.");
      return;
    }

    setPending(true);
    setModalError(null);
    try {
      if (paymentMethod === "paystack") {
        setPayPhase("starting");
        const res = await initPaystackOrder(payload);
        if (!res.ok) {
          if (res.code === "PRICE_CHANGED") {
            const changed = res as unknown as { old: PriceSnapshot; new: PriceSnapshot };
            setDrift({ old: changed.old, new: changed.new });
            setModalError(`${res.message} The Paystack quote below is updated — confirm again to pay.`);
            setPending(false);
            setPayPhase("idle");
            return;
          }
          if (res.code === "PAYMENT_METHOD_MISMATCH") {
            rotateTokenAfterMismatch();
            setModalError(`${res.message} A fresh checkout is ready — confirm again.`);
            setFormError(`${res.message} A fresh checkout is ready — confirm again.`);
            setPending(false);
            setPayPhase("idle");
            return;
          }
          if (res.code === "UNAUTHENTICATED") setSessionExpired(true);
          setModalError(res.message);
          setFormError(res.message);
          setPending(false);
          setPayPhase("idle");
          return;
        }
        if (res.data.paid) {
          // Token already paid (double-submit / webhook won the race).
          finishSuccess(res.data.orderId, true);
          return;
        }
        await runPaystackPopup({
          orderId: res.data.orderId,
          reference: res.data.reference,
          kobo: res.data.kobo,
        });
        return;
      }
      const res = await createOrder(payload);
      if (!res.ok) {
        if (res.code === "PRICE_CHANGED") {
          const changed = res as unknown as { old: PriceSnapshot; new: PriceSnapshot };
          setDrift({ old: changed.old, new: changed.new });
          setModalError(res.message);
          return;
        }
        if (res.code === "PAYMENT_METHOD_MISMATCH") {
          rotateTokenAfterMismatch();
          setModalError(`${res.message} A fresh checkout is ready — confirm again.`);
          setFormError(`${res.message} A fresh checkout is ready — confirm again.`);
          return;
        }
        if (res.code === "UNAUTHENTICATED") setSessionExpired(true);
        setModalError(res.message);
        setFormError(res.message);
        return;
      }
      finishSuccess(res.data.orderId, res.data.idempotent);
    } finally {
      if (paymentMethod === "cod") setPending(false);
      // Paystack keeps `pending` through popup → verify; those paths reset it.
    }
  }

  const err = (k: string) =>
    fieldErrors[k] ? (
      <span role="alert" className="mt-1 block text-xs text-clay">
        {fieldErrors[k]}
      </span>
    ) : null;

  const addressSummary = `${form.street}, ${form.city}, ${form.state} ${form.postal}, ${form.country}`;

  return (
    <>
      <form onSubmit={openConfirm} className="mt-8 grid grid-cols-12 gap-8" noValidate>
        <div className="col-span-12 flex flex-col gap-8 lg:col-span-7">
          <section aria-labelledby="contact-h" className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 id="contact-h" className="font-display text-xl">Contact</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs tracking-wide uppercase text-ink-mute">Full name</span>
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  autoComplete="name"
                />
                {err("name")}
              </label>
              <label className="block">
                <span className="mb-1 block text-xs tracking-wide uppercase text-ink-mute">Phone (rider calls this)</span>
                <input
                  className={inputCls}
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  autoComplete="tel"
                  placeholder="+234 …"
                  inputMode="tel"
                />
                {err("phone")}
              </label>
            </div>
            <label className="mt-4 block">
              <span className="mb-1 block text-xs tracking-wide uppercase text-ink-mute">
                Email (from your Google sign-in)
              </span>
              <input className={`${inputCls} bg-linen/50`} value={email} readOnly disabled aria-readonly />
            </label>
          </section>

          <section aria-labelledby="address-h" className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 id="address-h" className="font-display text-xl">Delivery address</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className="mb-1 block text-xs tracking-wide uppercase text-ink-mute">Country</span>
                <input className={inputCls} value={form.country} onChange={(e) => set("country", e.target.value)} autoComplete="country-name" />
                {err("country")}
              </label>
              <label className="block sm:col-span-1">
                <span className="mb-1 block text-xs tracking-wide uppercase text-ink-mute">State / region</span>
                <input className={inputCls} value={form.state} onChange={(e) => set("state", e.target.value)} autoComplete="address-level1" />
                {err("state")}
              </label>
              <label className="block sm:col-span-1">
                <span className="mb-1 block text-xs tracking-wide uppercase text-ink-mute">City</span>
                <input className={inputCls} value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" />
                {err("city")}
              </label>
              <label className="block sm:col-span-1">
                <span className="mb-1 block text-xs tracking-wide uppercase text-ink-mute">Postal code</span>
                <input className={inputCls} value={form.postal} onChange={(e) => set("postal", e.target.value)} autoComplete="postal-code" />
                {err("postal")}
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs tracking-wide uppercase text-ink-mute">Street address</span>
                <input className={inputCls} value={form.street} onChange={(e) => set("street", e.target.value)} autoComplete="street-address" placeholder="House, street, landmark" />
                {err("street")}
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs tracking-wide uppercase text-ink-mute">
                  Delivery zone <span className="text-clay">*</span>
                </span>
                <select
                  className={inputCls}
                  value={form.zoneId}
                  onChange={(e) => set("zoneId", e.target.value)}
                >
                  <option value="">Choose your delivery area to see the fee…</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
                {err("zoneId")}
                {hasZone && zone ? (
                  <span className="mt-1 block text-xs text-ink-soft">
                    Fee {price(shownFee)}
                    {eta ? ` · arrives in ${eta}` : ""}
                    {shownFee === 0 ? " · free delivery on this order" : ""}
                  </span>
                ) : null}
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs tracking-wide uppercase text-ink-mute">
                  Delivery notes (optional)
                </span>
                <textarea
                  className={`${inputCls} min-h-20`}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  maxLength={500}
                  placeholder="Gate code, landmark, best time to call…"
                />
                {err("notes")}
              </label>
            </div>
          </section>

          <section aria-labelledby="currency-h" className="rounded-lg border border-ink/10 bg-cream p-5">
            <h2 id="currency-h" className="font-display text-xl">Currency</h2>
            <label className="mt-4 block max-w-xs">
              <span className="mb-1 block text-xs tracking-wide uppercase text-ink-mute">Currency</span>
              <select
                className={inputCls}
                value={form.currencyCode}
                onChange={(e) => set("currencyCode", e.target.value)}
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} {c.code} — {c.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs text-ink-mute">
              Priced at today&apos;s rate — frozen on your order, never changes after checkout.
            </p>
          </section>

          {enabledMethods.length > 1 ? (
            <section aria-labelledby="payment-h" className="rounded-lg border border-ink/10 bg-cream p-5">
              <h2 id="payment-h" className="font-display text-xl">Payment</h2>
              <div role="radiogroup" aria-label="Payment method" className="mt-4 flex flex-col gap-2">
                {enabledMethods.map((m) => (
                  <label
                    key={m.code}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                      paymentMethod === m.code ? "border-bronze bg-bronze/5" : "border-ink/15"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={m.code}
                      checked={paymentMethod === m.code}
                      onChange={() => switchMethod(m.code as "cod" | "paystack")}
                      className="mt-1 accent-[#9A7B4F]"
                    />
                    <span>
                      <span className="block font-medium">
                        {m.code === "paystack" ? "Pay now with Paystack" : m.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-mute">
                        {m.code === "paystack"
                          ? "Card, transfer or USSD — charged immediately in naira."
                          : "Cash or transfer when the rider arrives — they call first."}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          ) : (
            <p role="status" className="rounded-lg border border-ink/10 bg-cream p-4 text-sm text-ink-soft">
              {paymentMethod === "paystack"
                ? "Pay now online with Paystack — charged immediately in naira."
                : "Pay on delivery — cash or transfer when the rider arrives."}
            </p>
          )}
        </div>

        <div className="col-span-12 lg:col-span-5">
          <section
            aria-labelledby="review-h"
            className="rounded-lg border border-ink/10 bg-cream p-5 lg:sticky lg:top-24"
          >
            <h2 id="review-h" className="font-display text-xl">Review order</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {lines.map((l) => (
                <li key={l.productId} className="flex items-center gap-3">
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-linen">
                    {l.image ? (
                      <Image src={l.image} alt="" fill sizes="48px" className="object-cover" loading="lazy" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{l.name}</span>
                    <span className="block text-xs text-ink-mute">× {l.qty}</span>
                  </span>
                  <span className="text-sm font-medium">{price(l.lineBaseCents)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1.5 border-t border-ink/10 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd>{price(shownSubtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Delivery{hasZone && zone ? ` (${zone.name})` : ""}</dt>
                <dd>{hasZone ? price(shownFee) : "Choose your delivery area"}</dd>
              </div>
              <div className="flex justify-between border-t border-ink/10 pt-2 text-base font-medium">
                <dt>{paymentMethod === "paystack" ? "Total charged now" : "Total due on delivery"}</dt>
                <dd className="font-display text-xl">
                  {hasZone ? price(shownTotal) : `${price(shownSubtotal)} + ?`}
                </dd>
              </div>
            </dl>
            {paymentMethod === "paystack" && hasZone ? (
              <p role="status" className="mt-2 text-xs text-ink-mute">
                Paystack quote: {formatKobo(shownTotal)} — charged in naira, nothing due to the rider.
              </p>
            ) : null}
            {!hasZone ? (
              <p role="status" className="mt-2 text-xs text-ink-mute">
                Choose your delivery area to see the fee — arrival time depends on your area.
              </p>
            ) : null}
            {drift ? (
              <p role="status" className="mt-3 rounded-md bg-bronze/10 p-3 text-xs leading-relaxed text-ink">
                Prices changed since you reviewed — the new total is{" "}
                <strong>{price(shownTotal)}</strong>. Review and confirm again.
              </p>
            ) : null}
            {formError ? (
              <p role="alert" className="mt-4 rounded-md bg-clay/10 p-3 text-sm text-clay">
                {formError}
              </p>
            ) : null}
            {sessionExpired ? (
              <p role="alert" className="mt-4 rounded-md bg-clay/10 p-3 text-sm text-clay">
                Your session expired —{" "}
                <Link
                  href="/login?callbackURL=%2Fcheckout"
                  className="font-medium text-bronze-deep underline underline-offset-4"
                >
                  sign in again
                </Link>{" "}
                to place your order.
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending || !hasZone}
              aria-disabled={pending || !hasZone}
              title={!hasZone ? "Choose your delivery area to see your total" : undefined}
              className="rounded-pill mt-4 w-full bg-ink px-6 py-3 text-sm text-cream transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-50"
            >
              {!hasZone
                ? "Choose your delivery area to continue"
                : pending
                  ? payPhase === "verifying"
                    ? "Confirming payment…"
                    : payPhase === "popup"
                      ? "Waiting for Paystack…"
                      : paymentMethod === "paystack"
                        ? "Starting secure payment…"
                        : "Placing order…"
                  : paymentMethod === "paystack"
                    ? `Review order · ${price(shownTotal)} — pay now`
                    : `Review order · ${price(shownTotal)} — pay on delivery`}
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-ink-mute">
              By placing your order you agree to the{" "}
              <Link href="/terms" className="text-bronze-deep underline underline-offset-4">
                Terms
              </Link>
              ,{" "}
              <Link href="/shipping" className="text-bronze-deep underline underline-offset-4">
                Shipping
              </Link>{" "}
              and{" "}
              <Link href="/returns" className="text-bronze-deep underline underline-offset-4">
                Returns
              </Link>{" "}
              notes. Change your mind within 12 hours while pending — cancel free
              from your{" "}
              <Link href="/orders" className="text-bronze-deep underline underline-offset-4">
                orders page
              </Link>
              .
            </p>
          </section>
        </div>
      </form>

      {showConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          role="presentation"
          onClick={() => {
            if (!pending) setShowConfirm(false);
          }}
        >
          <div
            ref={confirmDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-order-h"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-cream p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-order-h" className="font-display text-2xl">
              Confirm your order
            </h2>
            <p className="mt-1 text-sm text-ink-mute">
              {paymentMethod === "paystack"
                ? "Check everything once — Paystack charges immediately in naira."
                : "Check everything once — nothing is charged until the rider arrives."}
            </p>

            {modalError ? (
              <p role="alert" className="mt-4 rounded-md bg-clay/10 p-3 text-sm text-clay">
                {modalError}
              </p>
            ) : null}
            {sessionExpired ? (
              <p role="alert" className="mt-4 rounded-md bg-clay/10 p-3 text-sm text-clay">
                Your session expired —{" "}
                <Link
                  href="/login?callbackURL=%2Fcheckout"
                  className="font-medium text-bronze-deep underline underline-offset-4"
                >
                  sign in again
                </Link>{" "}
                to place your order.
              </p>
            ) : null}
            {drift ? (
              <div role="status" className="mt-4 rounded-md border border-bronze/30 bg-bronze/10 p-3 text-sm">
                <p className="font-medium">Prices changed since you reviewed.</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  Old total{" "}
                  {priceWith(
                    drift.old.totalBaseCents,
                    drift.old.rateToBase,
                    drift.old.currencyCode,
                    currency.symbol,
                  )}{" "}
                  → new total{" "}
                  <strong className="text-ink">
                    {priceWith(
                      drift.new.totalBaseCents,
                      drift.new.rateToBase,
                      drift.new.currencyCode,
                      currency.symbol,
                    )}
                  </strong>
                  . Subtotal{" "}
                  {priceWith(
                    drift.old.subtotalBaseCents,
                    drift.old.rateToBase,
                    drift.old.currencyCode,
                    currency.symbol,
                  )}{" "}
                  →{" "}
                  {priceWith(
                    drift.new.subtotalBaseCents,
                    drift.new.rateToBase,
                    drift.new.currencyCode,
                    currency.symbol,
                  )}
                  , delivery{" "}
                  {priceWith(
                    drift.old.shippingBaseCents,
                    drift.old.rateToBase,
                    drift.old.currencyCode,
                    currency.symbol,
                  )}{" "}
                  →{" "}
                  {priceWith(
                    drift.new.shippingBaseCents,
                    drift.new.rateToBase,
                    drift.new.currencyCode,
                    currency.symbol,
                  )}
                  . Confirm again to accept the new total.
                </p>
              </div>
            ) : null}

            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs tracking-wide uppercase text-ink-mute">Deliver to</dt>
                <dd className="mt-0.5">
                  <strong>{form.name}</strong> · {form.phone}
                  <br />
                  {form.street ? addressSummary : "Address incomplete"}
                  {form.notes.trim() ? (
                    <>
                      <br />
                      <span className="text-ink-mute">Note: {form.notes.trim()}</span>
                    </>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide uppercase text-ink-mute">Delivery zone</dt>
                <dd className="mt-0.5">
                  {zone?.name ?? "—"} · {price(shownFee)}
                  {eta ? ` · arrives in ${eta}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide uppercase text-ink-mute">Payment method</dt>
                <dd className="mt-0.5">
                  {paymentMethod === "paystack" ? "Pay now with Paystack" : "Cash on delivery"}
                  {paymentMethod === "paystack" ? (
                    <span className="mt-1 block text-xs text-ink-mute">
                      Paystack quote: <strong className="text-ink">{formatKobo(shownTotal)}</strong>{" "}
                      ({PAYSTACK_CURRENCY}) — charged now, nothing due to the rider.
                    </span>
                  ) : (
                    <span className="mt-1 block text-xs text-ink-mute">
                      Keep {price(shownTotal)} ready — the rider calls before arriving.
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide uppercase text-ink-mute">Currency</dt>
                <dd className="mt-0.5">
                  {currency.symbol} {currency.code} — {currency.label}
                </dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide uppercase text-ink-mute">
                  Items ({lines.length})
                </dt>
                <dd className="mt-1">
                  <ul className="flex flex-col gap-2">
                    {lines.map((l) => (
                      <li key={l.productId} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 flex-1 truncate">
                          {l.name} <span className="text-ink-mute">× {l.qty}</span>
                        </span>
                        <span className="font-medium">{price(l.lineBaseCents)}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div className="space-y-1.5 border-t border-ink/10 pt-3">
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Subtotal</dt>
                  <dd>{price(shownSubtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Delivery{zone ? ` (${zone.name})` : ""}</dt>
                  <dd>{price(shownFee)}</dd>
                </div>
                <div className="flex justify-between border-t border-ink/10 pt-2 text-base font-medium">
                  <dt>{paymentMethod === "paystack" ? "Total charged now" : "Total due on delivery"}</dt>
                  <dd className="font-display text-xl">{price(shownTotal)}</dd>
                </div>
              </div>
            </dl>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={pending}
                onClick={() => setShowConfirm(false)}
                className="rounded-pill border border-ink/20 px-5 py-2.5 text-sm text-ink disabled:opacity-50"
              >
                Back to edit
              </button>
              <button
                type="button"
                ref={confirmButtonRef}
                disabled={pending}
                onClick={confirmPlaceOrder}
                className="rounded-pill bg-ink px-5 py-2.5 text-sm text-cream disabled:opacity-50"
              >
                {pending ? (
                  payPhase === "verifying" ? (
                    "Confirming payment…"
                  ) : payPhase === "popup" ? (
                    "Waiting for Paystack…"
                  ) : paymentMethod === "paystack" ? (
                    "Starting secure payment…"
                  ) : (
                    "Placing order…"
                  )
                ) : paymentMethod === "paystack" ? (
                  `Pay ${price(shownTotal)} now`
                ) : (
                  `Place order · ${price(shownTotal)}`
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

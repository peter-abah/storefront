"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createOrder } from "@/lib/actions/checkout";
import { checkoutSchema } from "@/lib/validations";
import { formatDisplay, toDisplay } from "@/lib/money";
import { notifyCartUpdated } from "@/lib/cart-events";

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

type Props = {
  email: string;
  name: string;
  zones: Zone[];
  currencies: CurrencyOpt[];
  defaultCurrencyCode: string;
  lines: Line[];
  subtotalBaseCents: number;
};

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
}: Props) {
  const router = useRouter();
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
  const [pending, setPending] = useState(false);
  const [clientToken] = useState(newToken);

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
  const total = subtotalBaseCents + fee;

  const price = (baseCents: number) =>
    formatDisplay(toDisplay(baseCents, currency.rateToBase), currency);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const payload = {
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
    };

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

    setPending(true);
    try {
      const res = await createOrder(payload);
      if (!res.ok) {
        setFormError(res.message);
        return;
      }
      notifyCartUpdated();
      router.push(`/orders/${res.data.orderId}?new=1`);
    } finally {
      setPending(false);
    }
  }

  const err = (k: string) =>
    fieldErrors[k] ? (
      <span role="alert" className="mt-1 block text-xs text-clay">
        {fieldErrors[k]}
      </span>
    ) : null;

  return (
    <form onSubmit={submit} className="mt-8 grid grid-cols-12 gap-8" noValidate>
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
              {zone ? (
                <span className="mt-1 block text-xs text-ink-soft">
                  Fee {price(fee)}
                  {eta ? ` · arrives in ${eta}` : ""}
                  {fee === 0 ? " · free delivery on this order" : ""}
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
            Totals settle at today&apos;s rate — your order never changes after checkout.
          </p>
        </section>
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
              <dd>{price(subtotalBaseCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Delivery{zone ? ` (${zone.name})` : ""}</dt>
              <dd>{form.zoneId ? price(fee) : "—"}</dd>
            </div>
            <div className="flex justify-between border-t border-ink/10 pt-2 text-base font-medium">
              <dt>Total due on delivery</dt>
              <dd className="font-display text-xl">{price(total)}</dd>
            </div>
          </dl>
          {formError ? (
            <p role="alert" className="mt-4 rounded-md bg-clay/10 p-3 text-sm text-clay">
              {formError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded-pill mt-4 w-full bg-ink px-6 py-3 text-sm text-cream transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-50"
          >
            {pending ? "Placing order…" : `Place order · ${price(total)} — pay on delivery`}
          </button>
          <p className="mt-2 text-center text-xs text-ink-mute">
            Prices confirmed before payment — no surprises on arrival.
          </p>
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
  );
}

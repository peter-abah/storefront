"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adjustStock, toggleProductActive, upsertProduct, type AdminProduct } from "@/lib/actions/admin";

const inputCls =
  "w-full rounded-md border border-ink/20 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink-mute focus:border-bronze focus:outline-none";
const labelCls = "mb-1 block text-xs tracking-wide uppercase text-ink-mute";

function toMaterialsText(p?: AdminProduct | null): string {
  if (!p?.materials) return "";
  return p.materials.join(", ");
}

function toImagesText(p?: AdminProduct | null): string {
  if (!p?.images) return "";
  return p.images.map((i) => i.url).join("\n");
}

export function ProductForm({ product }: { product?: AdminProduct | null }) {
  const router = useRouter();
  const isEdit = Boolean(product?.id);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<{
    name: string;
    slug: string;
    tagline: string;
    story: string;
    priceBaseCents: string;
    stock: string;
    room: string;
    category: string;
    materialsText: string;
    dimW: string;
    dimD: string;
    dimH: string;
    dimUnit: string;
    weightKg: string;
    care: string;
    imagesText: string;
    active: boolean;
    featured: boolean;
  }>({
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    tagline: product?.tagline ?? "",
    story: product?.story ?? "",
    priceBaseCents: String(product?.priceBaseCents ?? ""),
    stock: String(product?.stock ?? ""),
    room: product?.room ?? "living",
    category: product?.category ?? "furniture",
    materialsText: toMaterialsText(product),
    dimW: product?.dimensions ? String(product.dimensions.w) : "",
    dimD: product?.dimensions ? String(product.dimensions.d) : "",
    dimH: product?.dimensions ? String(product.dimensions.h) : "",
    dimUnit: product?.dimensions?.unit ?? "cm",
    weightKg: product?.weightKg ?? "",
    care: product?.care ?? "",
    imagesText: toImagesText(product),
    active: product?.active ?? true,
    featured: product?.featured ?? false,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const payload = {
        ...(product?.id ? { id: product.id } : {}),
        name: form.name,
        slug: form.slug,
        tagline: form.tagline,
        story: form.story,
        priceBaseCents: form.priceBaseCents === "" ? Number.NaN : Number(form.priceBaseCents),
        stock: form.stock === "" ? Number.NaN : Number(form.stock),
        room: form.room,
        category: form.category,
        materialsText: form.materialsText,
        ...(form.dimW === "" && form.dimD === "" && form.dimH === ""
          ? {}
          : { dimW: form.dimW, dimD: form.dimD, dimH: form.dimH }),
        dimUnit: form.dimUnit,
        weightKg: form.weightKg,
        care: form.care,
        imagesText: form.imagesText,
        active: form.active,
        featured: form.featured,
      };
      const res = await upsertProduct(payload);
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
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={`rounded-pill px-4 py-1.5 text-sm transition-transform duration-200 hover:-translate-y-0.5 ${
          isEdit ? "border border-ink/15 text-ink-soft hover:text-ink" : "bg-ink text-cream"
        }`}
      >
        {isEdit ? "Edit" : "New product"}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={isEdit ? "Edit product" : "New product"}>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40 opacity-100 transition-opacity duration-200"
          />
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-ink/10 bg-paper p-5 transition-transform duration-200">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl">{isEdit ? "Edit product" : "New product"}</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-pill border border-ink/15 px-3 py-1 text-sm">
                Close
              </button>
            </div>
            <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
              <label className="block sm:col-span-2">
                <span className={labelCls}>Name *</span>
                <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} required />
              </label>
              <label className="block">
                <span className={labelCls}>Link name — leave blank to create from title</span>
                <input className={inputCls} value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="oak-lounge-chair" />
              </label>
              <label className="block">
                <span className={labelCls}>Tagline</span>
                <input className={inputCls} value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelCls}>Story</span>
                <textarea className={`${inputCls} min-h-20`} value={form.story} onChange={(e) => set("story", e.target.value)} />
              </label>
              <label className="block">
                <span className={labelCls}>Price — base currency, smallest unit (e.g. 129900 for ₦1,299.00) *</span>
                <input className={inputCls} value={form.priceBaseCents} onChange={(e) => set("priceBaseCents", e.target.value)} inputMode="numeric" placeholder="129900" />
              </label>
              <label className="block">
                <span className={labelCls}>Stock (units, ≥ 0) *</span>
                <input className={inputCls} value={form.stock} onChange={(e) => set("stock", e.target.value)} inputMode="numeric" placeholder="12" />
              </label>
              <label className="block">
                <span className={labelCls}>Room *</span>
                <select className={inputCls} value={form.room} onChange={(e) => set("room", e.target.value)}>
                  {["living", "bedroom", "dining", "bath", "decor", "outdoor"].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Category *</span>
                <select className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)}>
                  {["furniture", "lighting", "textiles", "decor", "tableware"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className={labelCls}>Materials (comma-separated)</span>
                <input className={inputCls} value={form.materialsText} onChange={(e) => set("materialsText", e.target.value)} placeholder="oak, linen, brass" />
              </label>
              <fieldset className="grid grid-cols-2 gap-4 sm:col-span-2 sm:grid-cols-4">
                <legend className="text-xs tracking-wide uppercase text-ink-mute">Dimensions (leave blank for none)</legend>
                <label className="block">
                  <span className={labelCls}>W</span>
                  <input className={inputCls} value={form.dimW} onChange={(e) => set("dimW", e.target.value)} inputMode="decimal" placeholder="80" />
                </label>
                <label className="block">
                  <span className={labelCls}>D</span>
                  <input className={inputCls} value={form.dimD} onChange={(e) => set("dimD", e.target.value)} inputMode="decimal" placeholder="40" />
                </label>
                <label className="block">
                  <span className={labelCls}>H</span>
                  <input className={inputCls} value={form.dimH} onChange={(e) => set("dimH", e.target.value)} inputMode="decimal" placeholder="75" />
                </label>
                <label className="block">
                  <span className={labelCls}>Unit</span>
                  <input className={inputCls} value={form.dimUnit} onChange={(e) => set("dimUnit", e.target.value)} placeholder="cm" />
                </label>
              </fieldset>
              <label className="block">
                <span className={labelCls}>Weight (kg, e.g. 12.5)</span>
                <input className={inputCls} value={form.weightKg} onChange={(e) => set("weightKg", e.target.value)} inputMode="decimal" />
              </label>
              <label className="block">
                <span className={labelCls}>Care</span>
                <input className={inputCls} value={form.care} onChange={(e) => set("care", e.target.value)} />
              </label>
              <div className="block sm:col-span-2">
                <span className={labelCls}>Direct upload — unavailable</span>
                <input className={`${inputCls} opacity-60`} value="" placeholder="maison_products preset — unavailable" disabled aria-disabled />
                <p className="mt-1 text-xs text-ink-mute">
                  Direct uploads are off — paste one image URL per line below, http(s) only.
                </p>
              </div>
              <label className="block sm:col-span-2">
                <span className={labelCls}>Image URLs (one per line)</span>
                <textarea
                  className={`${inputCls} min-h-24 font-mono text-xs`}
                  value={form.imagesText}
                  onChange={(e) => set("imagesText", e.target.value)}
                  placeholder={"https://res.cloudinary.com/…/chair.jpg\nhttps://images.unsplash.com/photo-…?w=1200"}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
                Active (visible in shop)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} />
                Featured
              </label>
              {error ? (
                <p role="alert" className="rounded-md bg-clay/10 p-3 text-sm text-clay sm:col-span-2">{error}</p>
              ) : null}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-pill border border-ink/15 px-5 py-2 text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={pending} className="rounded-pill bg-ink px-5 py-2 text-sm text-cream disabled:opacity-50">
                  {pending ? "Saving…" : isEdit ? "Save changes" : "Create product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ProductRowActions({ product }: { product: AdminProduct }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await toggleProductActive(product.id);
      if (!res.ok) setError(res.message);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function step(delta: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await adjustStock(product.id, delta);
      if (!res.ok) setError(res.message);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={product.active}
        className={`rounded-pill px-3 py-1 text-xs transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-50 ${
          product.active ? "bg-moss/15 text-moss" : "bg-ink/10 text-ink-mute"
        }`}
      >
        {product.active ? "Active" : "Hidden"}
      </button>
      <span className="flex items-center gap-1" aria-label={`Stock for ${product.name}`}>
        <button type="button" onClick={() => step(-1)} disabled={busy} aria-label="Decrease stock" className="rounded-md border border-ink/15 px-2 py-0.5 text-sm disabled:opacity-50">−</button>
        <span className="min-w-8 text-center text-sm">{product.stock}</span>
        <button type="button" onClick={() => step(1)} disabled={busy} aria-label="Increase stock" className="rounded-md border border-ink/15 px-2 py-0.5 text-sm disabled:opacity-50">+</button>
      </span>
      {error ? <span role="alert" className="text-xs text-clay">{error}</span> : null}
    </div>
  );
}

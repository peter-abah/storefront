import { listCurrencies, listPaymentMethods, listZones } from "@/lib/actions/admin";
import { CurrencyForm } from "@/components/admin/CurrencyForm";
import { PaymentMethodForm } from "@/components/admin/PaymentMethodForm";
import { ZoneForm } from "@/components/admin/ZoneForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin settings — Maison",
  description: "Currencies, payment methods and shipping zones — no deploys needed.",
};

export default async function AdminSettingsPage() {
  const [curRes, zoneRes, payRes] = await Promise.all([
    listCurrencies(),
    listZones(),
    listPaymentMethods(),
  ]);
  if (!curRes.ok) {
    return (
      <main className="editorial-grid py-10">
        <div className="col-span-12">
          <p role="alert" className="rounded-md bg-clay/10 p-4 text-sm text-clay">{curRes.message}</p>
        </div>
      </main>
    );
  }
  if (!zoneRes.ok) {
    return (
      <main className="editorial-grid py-10">
        <div className="col-span-12">
          <p role="alert" className="rounded-md bg-clay/10 p-4 text-sm text-clay">{zoneRes.message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="editorial-grid py-10">
      <div className="col-span-12">
        <p className="text-xs tracking-[0.3em] uppercase text-bronze">Settings</p>
        <h2 className="font-display mt-2 text-4xl">Money + delivery</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">
          Prices follow the base currency and convert at checkout. A zero fee means complimentary delivery over that
          amount. Past orders never change.
        </p>
      </div>
      <div className="col-span-12 mt-8 lg:col-span-6">
        <h3 className="font-display text-2xl">Currencies</h3>
        <div className="mt-4">
          <CurrencyForm currencies={curRes.data} />
        </div>
      </div>
      <div className="col-span-12 mt-8 lg:col-span-6">
        <h3 className="font-display text-2xl">Payment methods</h3>
        <div className="mt-4">
          {payRes.ok ? (
            <PaymentMethodForm methods={payRes.data} />
          ) : (
            <p role="alert" className="rounded-md bg-clay/10 p-4 text-sm text-clay">{payRes.message}</p>
          )}
        </div>
      </div>
      <div className="col-span-12 mt-8 lg:col-span-6">
        <h3 className="font-display text-2xl">Shipping zones</h3>
        <div className="mt-4">
          <ZoneForm zones={zoneRes.data} />
        </div>
      </div>
    </main>
  );
}

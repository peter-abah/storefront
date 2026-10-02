import { CartView } from "@/components/cart/CartView";

export const metadata = {
  title: "Cart — Maison",
  description: "Review your pieces before checkout.",
};

export default function CartPage() {
  return (
    <main className="editorial-grid py-10 md:py-14">
      <div className="col-span-12 lg:col-span-8 lg:col-start-3">
        <p className="text-xs tracking-[0.3em] uppercase text-bronze">Cart</p>
        <h1 className="font-display mt-2 text-4xl md:text-6xl">Your selection</h1>
        <div className="mt-8">
          <CartView variant="page" />
        </div>
      </div>
    </main>
  );
}

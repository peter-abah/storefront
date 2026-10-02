import Link from "next/link";
import { CONTACT, supportEmail } from "@/lib/contact";

/**
 * Storefront footer — brand closure + wayfinding + contact identity.
 * Phase 1 trust shell: Shop + Help (6 legal pages) + Contact columns.
 * Identity values are Phase 0 DRAFTs (docs/BUSINESS_FACTS.md) — launch-blocking.
 */
export function SiteFooter() {
  const email = supportEmail();

  return (
    <footer className="border-t border-ink/10 bg-cream/60">
      <div className="editorial-grid py-10">
        <div className="col-span-12 md:col-span-4">
          <p className="font-display text-2xl tracking-tight">Maison</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            Small-batch furniture, lighting and textiles for warm,
            lived-in rooms — cash on delivery.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-ink-mute">
            {CONTACT.tradingName} · {CONTACT.cac} (details pending verification)
          </p>
        </div>
        <nav aria-label="Shop" className="col-span-6 mt-8 md:col-span-2 md:mt-0">
          <p className="text-xs tracking-[0.18em] uppercase text-ink-mute">Shop</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/shop" className="text-ink-soft hover:text-bronze-deep">
                All pieces
              </Link>
            </li>
            <li>
              <Link href="/cart" className="text-ink-soft hover:text-bronze-deep">
                Your selection
              </Link>
            </li>
            <li>
              <Link href="/orders" className="text-ink-soft hover:text-bronze-deep">
                Track orders
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Help" className="col-span-6 mt-8 md:col-span-2 md:mt-0">
          <p className="text-xs tracking-[0.18em] uppercase text-ink-mute">Help</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/shipping" className="text-ink-soft hover:text-bronze-deep">
                Shipping
              </Link>
            </li>
            <li>
              <Link href="/returns" className="text-ink-soft hover:text-bronze-deep">
                Returns
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-ink-soft hover:text-bronze-deep">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-ink-soft hover:text-bronze-deep">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/faq" className="text-ink-soft hover:text-bronze-deep">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/contact" className="text-ink-soft hover:text-bronze-deep">
                Contact
              </Link>
            </li>
          </ul>
        </nav>
        <div className="col-span-12 mt-8 md:col-span-4 md:mt-0">
          <p className="text-xs tracking-[0.18em] uppercase text-ink-mute">Contact</p>
          <address className="mt-3 text-sm leading-relaxed text-ink-soft not-italic">
            {CONTACT.address}
            <br />
            <a href={CONTACT.phoneHref} className="text-bronze-deep underline underline-offset-4">
              {CONTACT.phoneDisplay}
            </a>{" "}
            ·{" "}
            <a
              href={CONTACT.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-bronze-deep underline underline-offset-4"
            >
              WhatsApp
            </a>
            <br />
            <a
              href={`mailto:${email}`}
              className="text-bronze-deep underline underline-offset-4"
            >
              {email}
            </a>
            <br />
            <span className="text-ink-mute">{CONTACT.hours}</span>
          </address>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Cash on delivery across Lagos, nationwide and international —
            the rider calls before arrival.
          </p>
        </div>
        <p className="col-span-12 mt-8 border-t border-ink/10 pt-4 text-xs text-ink-mute">
          Maison · Home &amp; Living — photography shown is illustrative of
          each collection. Contact details shown are pending verification.
        </p>
      </div>
    </footer>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { EASE_EXPO } from "@/components/storefront/Reveal";
import { useSmoothScroll } from "@/components/providers/smooth-scroll-provider";
import { CartView } from "./CartView";

/**
 * Slide-over cart drawer (transform/opacity only). Pauses Lenis while open
 * so the backdrop never scrolls under the panel. Closes on route change
 * plus /cart and /checkout navigation via onNavigate, traps focus while
 * open, focuses the close button on open, and returns focus to the opener
 * on close.
 */
export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const hasOpened = useRef(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const { stop, start } = useSmoothScroll();
  const pathname = usePathname();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onOpen = () => {
      hasOpened.current = true;
      setOpen(true);
    };
    window.addEventListener("maison:cart-open", onOpen);
    return () => window.removeEventListener("maison:cart-open", onOpen);
  }, []);

  // Close on route change so the drawer never stays open over a new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    stop();
    // Initial focus on the close button once the panel mounts.
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0);

    const focusables = () =>
      panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      ) ?? [];

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const els = [...focusables()].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
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
      start();
      previouslyFocused.current?.focus?.();
      previouslyFocused.current = null;
    };
  }, [open, stop, start, close]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="cart-overlay"
          className="fixed inset-0 z-50 bg-ink/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={close}
          aria-hidden
        />
      ) : null}
      {open ? (
        <motion.aside
          key="cart-panel"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Shopping cart"
          className="fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col bg-paper shadow-lift"
          initial={{ x: "100%" }}
          animate={{ x: "0%" }}
          exit={{ x: "100%" }}
          transition={{ duration: 0.45, ease: [...EASE_EXPO] }}
        >
          <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
            <h2 className="font-display text-xl">Your cart</h2>
            <button
              type="button"
              ref={closeBtnRef}
              onClick={close}
              aria-label="Close cart"
              className="rounded-pill border border-ink/20 px-3 py-1 text-sm hover:border-bronze"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4" data-lenis-prevent>
            {hasOpened.current ? <CartView variant="drawer" onNavigate={close} /> : null}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

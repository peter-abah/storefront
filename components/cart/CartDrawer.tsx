"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { EASE_EXPO } from "@/components/storefront/Reveal";
import { useSmoothScroll } from "@/components/providers/smooth-scroll-provider";
import { CartView } from "./CartView";

/**
 * Slide-over cart drawer (transform/opacity only). Pauses Lenis while open
 * so the backdrop never scrolls under the panel.
 */
export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const hasOpened = useRef(false);
  const { stop, start } = useSmoothScroll();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onOpen = () => {
      hasOpened.current = true;
      setOpen(true);
    };
    window.addEventListener("maison:cart-open", onOpen);
    return () => window.removeEventListener("maison:cart-open", onOpen);
  }, []);

  useEffect(() => {
    if (open) {
      stop();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") close();
      };
      window.addEventListener("keydown", onKey);
      return () => {
        window.removeEventListener("keydown", onKey);
        start();
      };
    }
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
              onClick={close}
              aria-label="Close cart"
              className="rounded-pill border border-ink/20 px-3 py-1 text-sm hover:border-bronze"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4" data-lenis-prevent>
            {hasOpened.current ? <CartView variant="drawer" /> : null}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { ReactLenis, type LenisRef } from "lenis/react";

type SmoothScrollContextValue = {
  /** Pause Lenis (e.g. when the cart drawer opens). */
  stop: () => void;
  /** Resume Lenis (e.g. when the cart drawer closes). */
  start: () => void;
};

const SmoothScrollContext = createContext<SmoothScrollContextValue | null>(
  null,
);

export function useSmoothScroll(): SmoothScrollContextValue {
  const ctx = useContext(SmoothScrollContext);
  if (!ctx) {
    // Safe no-op outside the provider (Wave 1 health page, tests).
    return { stop: () => {}, start: () => {} };
  }
  return ctx;
}

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisRef | null>(null);

  const stop = useCallback(() => {
    lenisRef.current?.lenis?.stop();
  }, []);

  const start = useCallback(() => {
    lenisRef.current?.lenis?.start();
  }, []);

  const value = useMemo(() => ({ stop, start }), [stop, start]);

  return (
    <SmoothScrollContext.Provider value={value}>
      <ReactLenis
        ref={lenisRef}
        root
        options={{ autoRaf: true, lerp: 0.1, smoothWheel: true }}
      >
        {children}
      </ReactLenis>
    </SmoothScrollContext.Provider>
  );
}

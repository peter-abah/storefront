import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatPrice, type CurrencyDTO } from "@maison/shared";
import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { bootstrap } from "./api";

const STORAGE_KEY = "@maison/currency-code";

type CurrencyContextValue = {
  currencies: CurrencyDTO[];
  currency: CurrencyDTO | null;
  code: string | null;
  setCurrency: (code: string) => void;
  isPending: boolean;
  error: Error | null;
  refetch: () => void;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: PropsWithChildren) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["bootstrap"],
    queryFn: bootstrap,
  });

  const currencies = useMemo(
    () => (data?.currencies ?? []).filter((c) => c.active),
    [data],
  );

  const base = useMemo(
    () => currencies.find((c) => c.isBase) ?? currencies[0] ?? null,
    [currencies],
  );

  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && stored) setSelected(stored);
      })
      .catch(() => {
        // A missing/broken store just means we fall back to the base currency.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!base) return;
    const known = currencies.some((c) => c.code === selected);
    if (!selected || !known) setSelected(base.code);
  }, [base, currencies, selected]);

  const setCurrency = useCallback((code: string) => {
    setSelected(code);
    AsyncStorage.setItem(STORAGE_KEY, code).catch(() => {
      // Persistence is best-effort; the in-memory choice still applies.
    });
  }, []);

  const currency = useMemo(
    () => currencies.find((c) => c.code === selected) ?? base,
    [currencies, selected, base],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currencies,
      currency,
      code: currency?.code ?? null,
      setCurrency,
      isPending,
      error,
      refetch,
    }),
    [currencies, currency, setCurrency, isPending, error, refetch],
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useCurrency must be used inside CurrencyProvider");
  }
  return ctx;
}

export function useMoney(): (baseCents: number) => string {
  const { currency } = useCurrency();
  return useCallback(
    (baseCents: number) => {
      if (!currency) return "—";
      return formatPrice(baseCents, {
        code: currency.code,
        symbol: currency.symbol,
        rateToBase: currency.rateToBase,
      });
    },
    [currency],
  );
}

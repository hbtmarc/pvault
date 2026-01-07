import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

type MonthContextValue = {
  monthKey: string; // YYYY-MM
  setMonthKey: (next: string) => void;
  prevMonth: () => void;
  nextMonth: () => void;
};

const MonthContext = createContext<MonthContextValue | null>(null);

const STORAGE_KEY = "pvault.monthKey";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isValidMonthKey(v: string | null | undefined): v is string {
  if (!v) return false;
  if (!/^\d{4}-\d{2}$/.test(v)) return false;
  const [, mm] = v.split("-");
  const m = Number(mm);
  return m >= 1 && m <= 12;
}

function nowMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function addMonthsToMonthKey(monthKey: string, delta: number): string {
  const [yy, mm] = monthKey.split("-");
  const y = Number(yy);
  const m = Number(mm);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // 1) Fonte inicial (prioridade): URL ?m=  -> localStorage -> mês atual
  const initial = useMemo(() => {
    const fromUrl = searchParams.get("m");
    if (isValidMonthKey(fromUrl)) return fromUrl;

    const fromStorage = localStorage.getItem(STORAGE_KEY);
    if (isValidMonthKey(fromStorage)) return fromStorage;

    return nowMonthKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intencional: calcular só 1x no mount

  const [monthKey, _setMonthKey] = useState<string>(initial);

  const setMonthKey = useCallback((next: string) => {
    if (!isValidMonthKey(next)) return;
    _setMonthKey((prev) => (prev === next ? prev : next));
  }, []);

  const prevMonth = useCallback(() => {
    _setMonthKey((prev) => addMonthsToMonthKey(prev, -1));
  }, []);

  const nextMonth = useCallback(() => {
    _setMonthKey((prev) => addMonthsToMonthKey(prev, +1));
  }, []);

  // 2) URL -> STATE (só atualiza state se realmente mudou)
  useEffect(() => {
    const fromUrl = searchParams.get("m");
    if (!isValidMonthKey(fromUrl)) return;
    _setMonthKey((prev) => (prev === fromUrl ? prev : fromUrl));
  }, [searchParams]);

  // 3) STATE -> URL (idempotente; usa replace para não “spammar” history)
  useEffect(() => {
    const current = searchParams.get("m");
    if (current === monthKey) return; // GUARD CRÍTICO (evita loop)

    const next = new URLSearchParams(searchParams);
    next.set("m", monthKey);

    // replace: não cria entradas infinitas no histórico
    setSearchParams(next, { replace: true });
  }, [monthKey, searchParams, setSearchParams]);

  // 4) Persistência local (para quando a URL não vier com ?m)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, monthKey);
  }, [monthKey]);

  const value = useMemo<MonthContextValue>(
    () => ({ monthKey, setMonthKey, prevMonth, nextMonth }),
    [monthKey, setMonthKey, prevMonth, nextMonth]
  );

  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>;
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth must be used within MonthProvider");
  return ctx;
}

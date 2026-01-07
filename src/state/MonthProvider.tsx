import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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

function resolveInitialMonthKey(urlM: string) {
  if (isValidMonthKey(urlM)) {
    return urlM;
  }

  if (typeof window !== "undefined") {
    const fromStorage = window.localStorage.getItem(STORAGE_KEY);
    if (isValidMonthKey(fromStorage)) {
      return fromStorage;
    }
  }

  return nowMonthKey();
}

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlM = searchParams.get("m") ?? "";
  const [monthKey, setMonthKeyState] = useState<string>(() =>
    resolveInitialMonthKey(urlM)
  );

  const setMonthKey = useCallback((next: string) => {
    if (!isValidMonthKey(next)) return;
    setMonthKeyState((prev) => (prev === next ? prev : next));
  }, []);

  const prevMonth = useCallback(() => {
    setMonthKeyState((prev) => addMonthsToMonthKey(prev, -1));
  }, []);

  const nextMonth = useCallback(() => {
    setMonthKeyState((prev) => addMonthsToMonthKey(prev, +1));
  }, []);

  // URL -> State
  useEffect(() => {
    if (!isValidMonthKey(urlM)) return;
    if (urlM !== monthKey) {
      setMonthKey(urlM);
    }
  }, [urlM, monthKey, setMonthKey]);

  // State -> URL
  useEffect(() => {
    if (!isValidMonthKey(monthKey)) return;
    if (urlM === monthKey) return;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (next.get("m") === monthKey) {
          return prev;
        }
        next.set("m", monthKey);
        return next;
      },
      { replace: true }
    );
  }, [monthKey, urlM, setSearchParams]);

  // Persist locally
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, monthKey);
    }
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

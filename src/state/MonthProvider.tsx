import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useSearchParams } from "react-router-dom";
import { getMonthKey, isValidMonthKey, shiftMonthKey } from "../lib/date";
import { setMonthInSearchParams } from "./monthUrl";

type MonthContextValue = {
  monthKey: string; // "YYYY-MM"
  setMonthKey: (next: string) => void;
  goPrevMonth: () => void;
  goNextMonth: () => void;
};

const MonthContext = createContext<MonthContextValue | null>(null);

const resolveCurrentMonthKey = () => getMonthKey(new Date());

const isValidMonth = (value: string | null | undefined): value is string =>
  isValidMonthKey(value);

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchStr = searchParams.toString();
  const urlM = searchParams.get("m");
  const fallbackMonth = useMemo(() => resolveCurrentMonthKey(), []);

  const monthKey = useMemo(
    () => (isValidMonth(urlM) ? urlM : fallbackMonth),
    [urlM, fallbackMonth]
  );

  useEffect(() => {
    if (isValidMonth(urlM)) {
      return;
    }

    const next = new URLSearchParams(searchStr);
    setMonthInSearchParams(next, setSearchParams, monthKey);
  }, [urlM, monthKey, searchStr, setSearchParams]);

  const setMonthKey = useCallback(
    (next: string) => {
      if (!isValidMonthKey(next)) {
        return;
      }
      setMonthInSearchParams(searchParams, setSearchParams, next);
    },
    [searchParams, setSearchParams]
  );

  const goPrevMonth = useCallback(
    () => setMonthKey(shiftMonthKey(monthKey, -1)),
    [monthKey, setMonthKey]
  );

  const goNextMonth = useCallback(
    () => setMonthKey(shiftMonthKey(monthKey, 1)),
    [monthKey, setMonthKey]
  );

  const value = useMemo<MonthContextValue>(
    () => ({ monthKey, setMonthKey, goPrevMonth, goNextMonth }),
    [monthKey, setMonthKey, goPrevMonth, goNextMonth]
  );

  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>;
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth must be used within MonthProvider");
  return ctx;
}

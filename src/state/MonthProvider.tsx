import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getMonthKey, isValidMonthKey } from "../lib/date";

type MonthContextValue = {
  monthKey: string;
  setMonthKey: (monthKey: string) => void;
};

const MonthContext = createContext<MonthContextValue | undefined>(undefined);

const STORAGE_KEY = "pvault.monthKey";

const readMonthKeyFromSearch = (search: string) => {
  const params = new URLSearchParams(search);
  const value = params.get("m");
  return isValidMonthKey(value) ? value : null;
};

export const MonthProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [monthKey, setMonthKeyState] = useState(() => {
    const fromSearch = readMonthKeyFromSearch(location.search);
    if (fromSearch) {
      return fromSearch;
    }

    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isValidMonthKey(stored)) {
        return stored as string;
      }
    }

    return getMonthKey(new Date());
  });

  useEffect(() => {
    const fromSearch = readMonthKeyFromSearch(location.search);
    if (fromSearch && fromSearch !== monthKey) {
      setMonthKeyState(fromSearch);
    }
  }, [location.search, monthKey]);

  const setMonthKey = (value: string) => {
    if (!isValidMonthKey(value)) {
      return;
    }
    setMonthKeyState(value);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, monthKey);
    }

    const params = new URLSearchParams(location.search);
    if (params.get("m") !== monthKey) {
      params.set("m", monthKey);
      const search = params.toString();
      navigate(
        { pathname: location.pathname, search: search ? `?${search}` : "" },
        { replace: true }
      );
    }
  }, [location.pathname, location.search, monthKey, navigate]);

  const value = useMemo(() => ({ monthKey, setMonthKey }), [monthKey]);

  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>;
};

export const useMonthContext = () => {
  const context = useContext(MonthContext);
  if (!context) {
    throw new Error("useMonthContext must be used within MonthProvider");
  }
  return context;
};

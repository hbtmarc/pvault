import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

type MonthContextValue = {
  monthKey: string;               // "YYYY-MM"
  setMonthKey: (next: string) => void;
};

const MonthContext = createContext<MonthContextValue | null>(null);

const STORAGE_KEY = "vf_monthKey";

function isValidMonthKey(v: string | null | undefined): v is string {
  return !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

function currentMonthKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function readStoredMonth(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isValidMonthKey(v) ? v : null;
  } catch {
    return null;
  }
}

function writeStoredMonth(v: string) {
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch {
    // ignore
  }
}

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derivados estáveis para evitar dependência por identidade do URLSearchParams
  const searchStr = searchParams.toString();
  const urlM = searchParams.get("m");

  // fallbackMonth é o que usamos quando a URL não tiver m (ou for inválido)
  const [fallbackMonth, setFallbackMonth] = useState<string>(() => {
    return readStoredMonth() ?? currentMonthKey();
  });

  // Fonte única: se URL tem m válido, vale ele; senão, usa fallbackMonth.
  const monthKey = useMemo(() => {
    return isValidMonthKey(urlM) ? urlM : fallbackMonth;
  }, [urlM, fallbackMonth]);

  // Garantia: se a URL estiver sem m (ou inválida), escrevemos UMA vez (replace) o monthKey resolvido.
  // Isso é one-way (URL inválida -> URL corrigida). Não existe state->URL via effect competindo.
  useEffect(() => {
    if (isValidMonthKey(urlM)) return;

    const next = new URLSearchParams(searchStr);
    next.set("m", monthKey);

    const nextStr = next.toString();
    if (nextStr === searchStr) return;

    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlM, monthKey, searchStr, setSearchParams]);

  const setMonthKey = (next: string) => {
    if (!isValidMonthKey(next)) return;

    // persistimos o fallback para o caso do usuário abrir a app sem query param no futuro
    setFallbackMonth(next);
    writeStoredMonth(next);

    // Se já está igual na URL, não navega (isso é crítico para não entrar em loop)
    if (searchParams.get("m") === next) return;

    // Atualiza preservando outros params — SEM mutar prev
    setSearchParams((prev) => {
      const prevStr = prev.toString();
      const sp = new URLSearchParams(prev);
      sp.set("m", next);

      // Se a serialização não mudou, devolve prev (sem navegação)
      if (sp.toString() === prevStr) return prev;

      return sp;
    }, { replace: true });
  };

  const value = useMemo<MonthContextValue>(() => ({ monthKey, setMonthKey }), [monthKey]);

  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>;
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth must be used within MonthProvider");
  return ctx;
}

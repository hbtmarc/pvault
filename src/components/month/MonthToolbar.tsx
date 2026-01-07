import { type ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import Button from "../Button";
import { useMonthKey } from "../../hooks/useMonthKey";

type MonthToolbarProps = {
  rightSlot?: ReactNode;
  className?: string;
};

const pad2 = (value: number) => value.toString().padStart(2, "0");

export const parseMonthKey = (monthKey: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() + 1 };
  }
  return { year: Number(match[1]), month: Number(match[2]) };
};

export const toMonthKey = (year: number, month: number) => {
  const safeDate = new Date(year, month - 1, 1);
  return `${safeDate.getFullYear()}-${pad2(safeDate.getMonth() + 1)}`;
};

export const addMonths = (monthKey: string, delta: number) => {
  const { year, month } = parseMonthKey(monthKey);
  const next = new Date(year, month - 1 + delta, 1);
  return toMonthKey(next.getFullYear(), next.getMonth() + 1);
};

export const currentMonthKey = () => {
  const now = new Date();
  return toMonthKey(now.getFullYear(), now.getMonth() + 1);
};

export const formatMonthLabel = (monthKey: string) => {
  const { year, month } = parseMonthKey(monthKey);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
    new Date(year, month - 1, 1)
  );
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return `${capitalized} ${year}`;
};

const MonthToolbar = ({ rightSlot, className }: MonthToolbarProps) => {
  const { monthKey, setMonthKey } = useMonthKey();
  const label = formatMonthLabel(monthKey);
  const todayKey = currentMonthKey();
  const isCurrentMonth = monthKey === todayKey;

  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 ${
        className ?? ""
      }`}
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-10 w-10 p-0 bg-white/70 shadow-sm"
          onClick={() => setMonthKey(addMonths(monthKey, -1))}
          aria-label="Mes anterior"
          title="Mes anterior"
        >
          ‹
        </Button>
        <div className="inline-flex h-10 min-w-[9rem] items-center justify-center rounded-lg border border-slate-200 bg-white/70 px-4 text-sm font-semibold text-slate-700 shadow-sm">
          {label}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="h-10 w-10 p-0 bg-white/70 shadow-sm"
          onClick={() => setMonthKey(addMonths(monthKey, 1))}
          aria-label="Proximo mes"
          title="Proximo mes"
        >
          ›
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-10 w-10 p-0 bg-white/70 shadow-sm"
          onClick={() => setMonthKey(todayKey)}
          aria-label="Voltar para o mes atual"
          title="Voltar para o mes atual"
          disabled={isCurrentMonth}
        >
          <CalendarDays className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      {rightSlot ? (
        <div className="flex items-center justify-start sm:justify-end">
          {rightSlot}
        </div>
      ) : null}
    </div>
  );
};

export default MonthToolbar;

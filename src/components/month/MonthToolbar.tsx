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

const getMonthText = (monthKey: string) => {
  const { year, month } = parseMonthKey(monthKey);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
    new Date(year, month - 1, 1)
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const formatMonthLabel = (monthKey: string) => {
  const { year } = parseMonthKey(monthKey);
  return `${getMonthText(monthKey)} ${year}`;
};

const MonthToolbar = ({ rightSlot, className }: MonthToolbarProps) => {
  const { monthKey, setMonthKey, goPrevMonth, goNextMonth } = useMonthKey();
  const { year } = parseMonthKey(monthKey);
  const monthText = getMonthText(monthKey);
  const todayKey = currentMonthKey();
  const isCurrentMonth = monthKey === todayKey;
  const controlBase =
    "h-10 rounded-lg border border-slate-200 bg-white/70 text-slate-700 shadow-sm";
  const controlIcon = `${controlBase} w-10 p-0`;
  const controlPill =
    `${controlBase} inline-flex items-center justify-center px-4 text-sm font-semibold`;

  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 ${
        className ?? ""
      }`}
    >
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <Button
          type="button"
          variant="secondary"
          className={controlIcon}
          onClick={goPrevMonth}
          aria-label="Mes anterior"
          title="Mes anterior"
        >
          {"<"}
        </Button>
        <div className={`${controlPill} cursor-default select-none`}>
          <span>{monthText}</span>
          <span className="ml-2 text-xs font-normal text-slate-500">{year}</span>
        </div>
        <Button
          type="button"
          variant="secondary"
          className={controlIcon}
          onClick={goNextMonth}
          aria-label="Proximo mes"
          title="Proximo mes"
        >
          {">"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={controlIcon}
          onClick={() => setMonthKey(todayKey)}
          aria-label="Voltar para o mes atual"
          title="Voltar para o mes atual"
          disabled={isCurrentMonth}
        >
          <CalendarDays className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      {rightSlot ? (
        <div className="flex w-full items-center justify-start sm:w-auto sm:ml-auto sm:justify-end">
          {rightSlot}
        </div>
      ) : null}
    </div>
  );
};

export default MonthToolbar;

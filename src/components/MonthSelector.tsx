import Button from "./Button";
import { shiftMonthKey } from "../lib/date";

type MonthSelectorProps = {
  monthKey: string;
  onChange: (monthKey: string) => void;
};

const MonthSelector = ({ monthKey, onChange }: MonthSelectorProps) => {
  const handlePrev = () => onChange(shiftMonthKey(monthKey, -1));
  const handleNext = () => onChange(shiftMonthKey(monthKey, 1));

  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" onClick={handlePrev}>
        Mes anterior
      </Button>
      <span className="text-sm font-semibold text-slate-700">{monthKey}</span>
      <Button variant="secondary" onClick={handleNext}>
        Proximo mes
      </Button>
    </div>
  );
};

export default MonthSelector;

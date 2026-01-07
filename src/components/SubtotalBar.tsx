import { formatCurrency } from "../lib/money";

type SubtotalBarProps = {
  title: string;
  itemsCount?: number;
  incomeCents?: number;
  expenseCents?: number;
  totalCents?: number;
};

const SubtotalBar = ({
  title,
  itemsCount,
  incomeCents,
  expenseCents,
  totalCents,
}: SubtotalBarProps) => {
  const showBreakdown =
    incomeCents !== undefined || expenseCents !== undefined;
  const safeIncome = incomeCents ?? 0;
  const safeExpense = expenseCents ?? 0;
  const balance = safeIncome - safeExpense;
  const totalValue = totalCents ?? balance;

  return (
    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-slate-900">{title}</span>
        {itemsCount !== undefined ? (
          <span className="text-xs text-slate-500">{itemsCount} itens</span>
        ) : null}
      </div>

      {showBreakdown ? (
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
          <span>Receitas: {formatCurrency(safeIncome)}</span>
          <span>Despesas: {formatCurrency(safeExpense)}</span>
          <span className="font-semibold text-slate-900">
            Saldo: {formatCurrency(balance)}
          </span>
        </div>
      ) : (
        <div className="mt-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-900">
            Subtotal: {formatCurrency(totalValue)}
          </span>
        </div>
      )}
    </div>
  );
};

export default SubtotalBar;

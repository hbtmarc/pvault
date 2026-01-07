import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorBanner from "../components/ErrorBanner";
import MonthSelector from "../components/MonthSelector";
import { useMonthKey } from "../hooks/useMonthKey";
import {
  type Budget,
  type Category,
  type FirestoreErrorInfo,
  getFirestoreErrorInfo,
  listBudgetsByMonth,
  listCategories,
  upsertBudget,
} from "../lib/firestore";
import { formatCentsToInput, formatCurrency, parseBRLToCents } from "../lib/money";
import { useAdmin } from "../providers/AdminProvider";

const BudgetPage = () => {
  const { authUid, effectiveUid, isImpersonating } = useAdmin();
  const { monthKey, setMonthKey } = useMonthKey();
  const canWrite = Boolean(authUid) && !isImpersonating;
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreErrorInfo | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!effectiveUid) {
      return undefined;
    }

    const unsubscribe = listCategories(
      effectiveUid,
      false,
      (items) => {
        setCategories(items);
      },
      (err) => setError(getFirestoreErrorInfo(err))
    );

    return () => unsubscribe();
  }, [effectiveUid]);

  useEffect(() => {
    if (!effectiveUid) {
      return undefined;
    }

    setLoading(true);
    const unsubscribe = listBudgetsByMonth(
      effectiveUid,
      monthKey,
      (items) => {
        setBudgets(items);
        setLoading(false);
      },
      (err) => {
        setError(getFirestoreErrorInfo(err));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [effectiveUid, monthKey]);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === "expense"),
    [categories]
  );

  const budgetByCategoryId = useMemo(() => {
    const map = new Map<string, Budget>();
    budgets.forEach((budget) => {
      map.set(budget.categoryId, budget);
    });
    return map;
  }, [budgets]);

  const totalAllocated = useMemo(
    () => budgets.reduce((sum, budget) => sum + budget.allocatedCents, 0),
    [budgets]
  );

  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    expenseCategories.forEach((category) => {
      const value = budgetByCategoryId.get(category.id)?.allocatedCents ?? 0;
      nextDrafts[category.id] = formatCentsToInput(value);
    });
    setDrafts(nextDrafts);
    setFieldErrors({});
  }, [expenseCategories, budgetByCategoryId, monthKey]);

  const handleChange = (categoryId: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [categoryId]: value }));
  };

  const handleSave = async (categoryId: string) => {
    if (!authUid || !canWrite) {
      return;
    }

    const raw = drafts[categoryId] ?? "";
    const trimmed = raw.trim();
    const amountCents = trimmed ? parseBRLToCents(trimmed) : 0;

    if (amountCents === null || Number.isNaN(amountCents)) {
      setFieldErrors((prev) => ({
        ...prev,
        [categoryId]: "Informe um valor valido.",
      }));
      return;
    }

    try {
      setSavingId(categoryId);
      setFieldErrors((prev) => ({ ...prev, [categoryId]: "" }));
      await upsertBudget(authUid, monthKey, categoryId, amountCents);
      setDrafts((prev) => ({
        ...prev,
        [categoryId]: formatCentsToInput(amountCents),
      }));
    } catch (err) {
      setError(getFirestoreErrorInfo(err));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <AppShell title="Orcamento" subtitle="Alocacao mensal por categoria">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <MonthSelector monthKey={monthKey} onChange={setMonthKey} />
        <div className="text-sm text-slate-600">
          Total alocado: {formatCurrency(totalAllocated)}
        </div>
      </div>

      <ErrorBanner info={error} className="mt-4" />

      <Card className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900">Categorias de despesa</h2>
        <p className="text-sm text-slate-500">
          Defina quanto voce pretende gastar em cada categoria.
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Carregando...</p>
        ) : null}

        {!loading && expenseCategories.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Crie categorias de despesa para definir orcamentos.
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {expenseCategories.map((category) => {
            const fieldError = fieldErrors[category.id];

            return (
              <div
                key={category.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {category.name}
                  </p>
                  <p className="text-xs text-slate-500">Despesa</p>
                </div>
                <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <div className="flex flex-col">
                    <input
                      className={`w-full rounded-lg border px-3 py-2 text-sm sm:w-36 ${
                        fieldError ? "border-rose-400" : "border-slate-200"
                      }`}
                      value={drafts[category.id] ?? ""}
                      onChange={(event) => handleChange(category.id, event.target.value)}
                      placeholder="0,00"
                      disabled={!canWrite}
                    />
                    {fieldError ? (
                      <span className="text-xs text-rose-500">{fieldError}</span>
                    ) : null}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => handleSave(category.id)}
                    loading={savingId === category.id}
                    disabled={!canWrite}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </AppShell>
  );
};

export default BudgetPage;

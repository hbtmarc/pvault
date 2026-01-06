import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorBanner from "../components/ErrorBanner";
import MonthSelector from "../components/MonthSelector";
import TransactionFormModal, {
  type TransactionDraft,
} from "../components/TransactionFormModal";
import { getMonthKey } from "../lib/date";
import {
  type Budget,
  type Category,
  type FirestoreErrorInfo,
  type PlannedItem,
  type RecurringRule,
  type Transaction,
  buildPlannedItems,
  createTransaction,
  getFirestoreErrorInfo,
  getFirestoreErrorMessage,
  listBudgetsByMonth,
  listCategories,
  listRecurringRules,
  listTransactionsByMonth,
  removeTransaction,
  updateTransaction,
} from "../lib/firestore";
import { formatCurrency } from "../lib/money";
import { useAuth } from "../providers/AuthProvider";

const HomePage = () => {
  const { user } = useAuth();
  const [monthKey, setMonthKey] = useState(getMonthKey(new Date()));
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreErrorInfo | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [showPlanned, setShowPlanned] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const unsubscribe = listCategories(
      user.uid,
      false,
      (items) => setCategories(items),
      (err) => setError(getFirestoreErrorInfo(err))
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    setLoading(true);

    const unsubscribe = listTransactionsByMonth(
      user.uid,
      monthKey,
      (items) => {
        setTransactions(items);
        setLoading(false);
      },
      (err) => {
        setError(getFirestoreErrorInfo(err));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, monthKey]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const unsubscribe = listBudgetsByMonth(
      user.uid,
      monthKey,
      (items) => setBudgets(items),
      (err) => setError(getFirestoreErrorInfo(err))
    );

    return () => unsubscribe();
  }, [user, monthKey]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const unsubscribe = listRecurringRules(
      user.uid,
      (items) => setRules(items),
      (err) => setError(getFirestoreErrorInfo(err))
    );

    return () => unsubscribe();
  }, [user]);

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, transaction) => {
        if (transaction.direction === "income") {
          acc.income += transaction.amountCents;
        } else {
          acc.expense += transaction.amountCents;
        }
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [transactions]);

  const totalAllocated = useMemo(
    () => budgets.reduce((sum, budget) => sum + budget.allocatedCents, 0),
    [budgets]
  );

  const available = totals.income - totalAllocated;

  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((category) => {
      map.set(category.id, category);
    });
    return map;
  }, [categories]);

  const plannedItems = useMemo<PlannedItem[]>(
    () => buildPlannedItems(monthKey, rules, transactions),
    [monthKey, rules, transactions]
  );

  const openCreateModal = () => {
    setEditing(null);
    setModalError("");
    setModalOpen(true);
  };

  const openEditModal = (transaction: Transaction) => {
    setEditing(transaction);
    setModalError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) {
      return;
    }
    setModalOpen(false);
  };

  const handleSave = async (values: TransactionDraft) => {
    if (!user) {
      return;
    }

    try {
      setSaving(true);
      setModalError("");

      if (editing) {
        await updateTransaction(user.uid, editing.id, values);
      } else {
        await createTransaction(user.uid, values);
      }

      setModalOpen(false);
      setEditing(null);
    } catch (err) {
      setModalError(getFirestoreErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (transaction: Transaction) => {
    if (!user) {
      return;
    }

    const confirmed = window.confirm("Excluir este lancamento?");
    if (!confirmed) {
      return;
    }

    try {
      await removeTransaction(user.uid, transaction.id);
    } catch (err) {
      setError(getFirestoreErrorInfo(err));
    }
  };

  const handleMarkAsPaid = async (item: PlannedItem) => {
    if (!user) {
      return;
    }

    try {
      setPayingId(item.id);
      await createTransaction(user.uid, {
        direction: item.direction,
        amountCents: item.amountCents,
        date: item.plannedDate,
        categoryId: item.categoryId,
        description: item.name,
        sourceType: "recurring",
        sourceRuleId: item.ruleId,
        plannedDate: item.plannedDate,
      });
    } catch (err) {
      setError(getFirestoreErrorInfo(err));
    } finally {
      setPayingId(null);
    }
  };

  return (
    <AppShell title="Dashboard" subtitle="Resumo mensal">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <MonthSelector monthKey={monthKey} onChange={setMonthKey} />
        <Button onClick={openCreateModal}>+ Novo lancamento</Button>
      </div>

      <ErrorBanner info={error} className="mt-4" />

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
            Receita
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(totals.income)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">
            Despesa
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(totals.expense)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Saldo
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(totals.income - totals.expense)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
            Disponivel
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(available)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Total alocado: {formatCurrency(totalAllocated)}
          </p>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Previstos</h2>
            <p className="text-sm text-slate-500">
              Recorrencias previstas para o mes selecionado.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showPlanned}
              onChange={(event) => setShowPlanned(event.target.checked)}
            />
            Mostrar previstos
          </label>
        </div>

        {!showPlanned ? (
          <p className="mt-4 text-sm text-slate-500">Previstos ocultos.</p>
        ) : null}

        {showPlanned && plannedItems.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nenhum previsto neste mes.</p>
        ) : null}

        {showPlanned ? (
          <div className="mt-4 space-y-3">
            {plannedItems.map((item) => {
              const badgeStyles =
                item.direction === "income"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-rose-100 text-rose-700";

              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">
                        Previsto
                      </span>
                      <span className={`rounded-full px-2 py-1 text-xs ${badgeStyles}`}>
                        {item.direction === "income" ? "Receita" : "Despesa"}
                      </span>
                      <span className="text-xs text-slate-500">{item.plannedDate}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {categoriesById.get(item.categoryId)?.name ??
                        "Categoria removida"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {formatCurrency(item.amountCents)}
                    </span>
                    <Button
                      variant="secondary"
                      onClick={() => handleMarkAsPaid(item)}
                      loading={payingId === item.id}
                    >
                      Marcar como pago
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </Card>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Lancamentos</h2>
          <span className="text-xs text-slate-500">
            {transactions.length} itens
          </span>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Carregando...</p>
        ) : null}

        {!loading && transactions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Nenhum lancamento neste mes.
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {transactions.map((transaction) => {
            const categoryName =
              categoriesById.get(transaction.categoryId)?.name ||
              "Categoria removida";
            const badgeStyles =
              transaction.direction === "income"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700";

            return (
              <div
                key={transaction.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs ${badgeStyles}`}>
                      {transaction.direction === "income" ? "Receita" : "Despesa"}
                    </span>
                    {transaction.sourceType === "recurring" ? (
                      <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">
                        Recorrente
                      </span>
                    ) : null}
                    <span className="text-xs text-slate-500">{transaction.date}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {categoryName}
                  </p>
                  {transaction.description ? (
                    <p className="text-xs text-slate-500">
                      {transaction.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {formatCurrency(transaction.amountCents)}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => openEditModal(transaction)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="secondary"
                    className="border-rose-200 text-rose-600 hover:border-rose-300"
                    onClick={() => handleDelete(transaction)}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <TransactionFormModal
        open={modalOpen}
        title={editing ? "Editar lancamento" : "Novo lancamento"}
        submitLabel={editing ? "Salvar" : "Criar"}
        categories={categories}
        initialValues={
          editing
            ? {
                direction: editing.direction,
                amountCents: editing.amountCents,
                date: editing.date,
                categoryId: editing.categoryId,
                description: editing.description,
              }
            : undefined
        }
        onSubmit={handleSave}
        onClose={closeModal}
        busy={saving}
        error={modalError}
      />
    </AppShell>
  );
};

export default HomePage;
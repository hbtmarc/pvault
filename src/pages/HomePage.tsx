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
  type Category,
  type FirestoreErrorInfo,
  type Transaction,
  createTransaction,
  getFirestoreErrorInfo,
  getFirestoreErrorMessage,
  listCategories,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreErrorInfo | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

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

  const balance = totals.income - totals.expense;

  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((category) => {
      map.set(category.id, category);
    });
    return map;
  }, [categories]);

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

  return (
    <AppShell title="Dashboard" subtitle="Resumo mensal">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <MonthSelector monthKey={monthKey} onChange={setMonthKey} />
        <Button onClick={openCreateModal}>+ Novo lancamento</Button>
      </div>

      <ErrorBanner info={error} className="mt-4" />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
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
            {formatCurrency(balance)}
          </p>
        </Card>
      </div>

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
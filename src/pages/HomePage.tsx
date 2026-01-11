import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorBanner from "../components/ErrorBanner";
import MonthToolbar from "../components/month/MonthToolbar";
import TransactionFormModal, {
  type TransactionDraft,
} from "../components/TransactionFormModal";
import { useMonthKey } from "../hooks/useMonthKey";
import {
  type Budget,
  type Card as CardType,
  type Category,
  type FirestoreErrorInfo,
  type InstallmentPlan,
  type PlannedItem,
  type RecurringRule,
  type Transaction,
  buildInstallmentPlannedItems,
  buildPlannedItems,
  createCardExpenseWithInstallments,
  createTransaction,
  getFirestoreErrorInfo,
  getFirestoreErrorMessage,
  listBudgetsByMonth,
  listCards,
  listCategories,
  listInstallmentPlans,
  listRecurringRules,
  listTransactionsByMonth,
  removeTransaction,
  upsertMerchantCategoryRule,
  updateTransaction,
} from "../lib/firestore";
import { formatCurrency } from "../lib/money";
import { buildMerchantKey } from "../lib/merchantRules";
import { useAdmin } from "../providers/AdminProvider";

const HomePage = () => {
  const { authUid, effectiveUid, isImpersonating } = useAdmin();
  const { monthKey } = useMonthKey();
  const canWrite = Boolean(authUid) && !isImpersonating;
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [archivedCards, setArchivedCards] = useState<CardType[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreErrorInfo | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [showPlanned, setShowPlanned] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveUid) {
      return undefined;
    }

    const unsubscribe = listCategories(
      effectiveUid,
      false,
      (items) => setCategories(items),
      (err) => setError(getFirestoreErrorInfo(err))
    );

    return () => unsubscribe();
  }, [effectiveUid]);

  useEffect(() => {
    if (!effectiveUid) {
      return undefined;
    }

    const unsubscribeActive = listCards(
      effectiveUid,
      false,
      (items) => setCards(items),
      (err) => setError(getFirestoreErrorInfo(err))
    );

    const unsubscribeArchived = listCards(
      effectiveUid,
      true,
      (items) => setArchivedCards(items),
      (err) => setError(getFirestoreErrorInfo(err))
    );

    return () => {
      unsubscribeActive();
      unsubscribeArchived();
    };
  }, [effectiveUid]);

  useEffect(() => {
    if (!effectiveUid) {
      return undefined;
    }

    const unsubscribe = listInstallmentPlans(
      effectiveUid,
      (items) => setInstallmentPlans(items),
      (err) => setError(getFirestoreErrorInfo(err))
    );

    return () => unsubscribe();
  }, [effectiveUid]);

  useEffect(() => {
    if (!effectiveUid) {
      return undefined;
    }

    setLoading(true);

    const unsubscribe = listTransactionsByMonth(
      effectiveUid,
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
  }, [effectiveUid, monthKey]);

  useEffect(() => {
    if (!effectiveUid) {
      return undefined;
    }

    const unsubscribe = listBudgetsByMonth(
      effectiveUid,
      monthKey,
      (items) => setBudgets(items),
      (err) => setError(getFirestoreErrorInfo(err))
    );

    return () => unsubscribe();
  }, [effectiveUid, monthKey]);

  useEffect(() => {
    if (!effectiveUid) {
      return undefined;
    }

    const unsubscribe = listRecurringRules(
      effectiveUid,
      (items) => setRules(items),
      (err) => setError(getFirestoreErrorInfo(err))
    );

    return () => unsubscribe();
  }, [effectiveUid]);

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, transaction) => {
        if (transaction.type === "transfer") {
          return acc;
        }
        if (transaction.type === "income") {
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

  const allCards = useMemo(() => [...cards, ...archivedCards], [cards, archivedCards]);

  const cardsById = useMemo(() => {
    const map = new Map<string, CardType>();
    allCards.forEach((card) => {
      map.set(card.id, card);
    });
    return map;
  }, [allCards]);

  const plannedRecurring = useMemo(
    () => buildPlannedItems(monthKey, rules, transactions),
    [monthKey, rules, transactions]
  );

  const plannedInstallments = useMemo(
    () =>
      buildInstallmentPlannedItems(monthKey, installmentPlans, allCards, transactions),
    [monthKey, installmentPlans, allCards, transactions]
  );

  const plannedItems = useMemo<PlannedItem[]>(
    () =>
      [...plannedRecurring, ...plannedInstallments].sort((a, b) =>
        b.plannedDate.localeCompare(a.plannedDate)
      ),
    [plannedRecurring, plannedInstallments]
  );

  const openCreateModal = () => {
    if (!canWrite) {
      return;
    }
    setEditing(null);
    setModalError("");
    setModalOpen(true);
  };

  const openEditModal = (transaction: Transaction) => {
    if (!canWrite) {
      return;
    }
    if (transaction.type === "transfer" || transaction.installmentPlanId) {
      return;
    }
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
    if (!authUid || !canWrite) {
      return;
    }

    try {
      setSaving(true);
      setModalError("");

      if (editing) {
        await updateTransaction(authUid, editing.id, {
          type: values.type,
          paymentMethod: values.paymentMethod,
          amountCents: values.amountCents,
          date: values.date,
          categoryId: values.categoryId,
          description: values.description,
          cardId: values.paymentMethod === "card" ? values.cardId : undefined,
          statementMonthKey:
            values.paymentMethod === "card" ? values.statementMonthKey : undefined,
          installmentPlanId: editing.installmentPlanId,
          installmentNumber: editing.installmentNumber,
          installmentsTotal: editing.installmentsTotal,
          installmentGroupId: editing.installmentGroupId,
          installmentIndex: editing.installmentIndex,
          installmentCount: editing.installmentCount,
          paidAt: editing.paidAt,
          paidByStatementId: editing.paidByStatementId,
          sourceType: editing.sourceType,
          sourceRuleId: editing.sourceRuleId,
          plannedDate: editing.plannedDate,
        });

        const nextCategoryId = values.categoryId ?? "";
        const previousCategoryId = editing.categoryId ?? "";
        const descriptionForRule =
          values.description?.trim() || editing.description?.trim() || "";
        if (
          nextCategoryId &&
          nextCategoryId !== previousCategoryId &&
          descriptionForRule
        ) {
          const merchantKey = buildMerchantKey(descriptionForRule);
          if (merchantKey) {
            await upsertMerchantCategoryRule(
              authUid,
              merchantKey,
              nextCategoryId
            );
          }
        }
      } else {
        if (
          values.paymentMethod === "card" &&
          values.installments &&
          values.installments > 1 &&
          values.cardId
        ) {
          const card = cards.find((item) => item.id === values.cardId);
          if (!card) {
            setModalError("Selecione um cartao valido.");
            return;
          }
          await createCardExpenseWithInstallments(
            authUid,
            {
              amountCents: values.amountCents,
              date: values.date,
              categoryId: values.categoryId ?? "",
              description: values.description,
            },
            card,
            values.installments
          );
        } else {
          await createTransaction(authUid, {
            type: values.type,
            paymentMethod: values.paymentMethod,
            amountCents: values.amountCents,
            date: values.date,
            categoryId: values.categoryId,
            description: values.description,
            cardId: values.paymentMethod === "card" ? values.cardId : undefined,
            statementMonthKey:
              values.paymentMethod === "card"
                ? values.statementMonthKey
                : undefined,
          });
        }
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
    if (!authUid || !canWrite) {
      return;
    }
    if (transaction.type === "transfer") {
      return;
    }

    const confirmed = window.confirm("Excluir este lancamento?");
    if (!confirmed) {
      return;
    }

    try {
      await removeTransaction(authUid, transaction.id);
    } catch (err) {
      setError(getFirestoreErrorInfo(err));
    }
  };

  const handleMarkAsPaid = async (item: PlannedItem) => {
    if (!authUid || !canWrite) {
      return;
    }

    try {
      setPayingId(item.id);
      if (item.kind === "recurring") {
        await createTransaction(authUid, {
          type: item.direction,
          paymentMethod: "cash",
          amountCents: item.amountCents,
          date: item.plannedDate,
          categoryId: item.categoryId,
          description: item.name,
          sourceType: "recurring",
          sourceRuleId: item.ruleId,
          plannedDate: item.plannedDate,
        });
      } else {
        await createTransaction(authUid, {
          type: item.direction,
          paymentMethod: "card",
          amountCents: item.amountCents,
          date: item.plannedDate,
          categoryId: item.categoryId,
          description: item.name,
          cardId: item.cardId,
          statementMonthKey: item.statementMonthKey,
          installmentPlanId: item.planId,
          installmentNumber: item.installmentNumber,
          installmentsTotal: item.installmentsTotal,
        });
      }
    } catch (err) {
      setError(getFirestoreErrorInfo(err));
    } finally {
      setPayingId(null);
    }
  };

  return (
    <AppShell title="Dashboard" subtitle="Resumo mensal">
      <MonthToolbar
        rightSlot={
          <Button onClick={openCreateModal} disabled={!canWrite}>
            + Novo lancamento
          </Button>
        }
      />

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
            Recorrencias e parcelas previstas para o mes selecionado.
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
              const categoryName =
                categoriesById.get(item.categoryId)?.name ??
                (item.categoryId ? "Categoria removida" : "Sem categoria");
              const cardName =
                item.kind === "installment"
                  ? cardsById.get(item.cardId)?.name ?? "Cartao removido"
                  : null;

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
                      {item.kind === "installment" ? (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          Parcela {item.installmentNumber}/{item.installmentsTotal}
                        </span>
                      ) : null}
                      <span className="text-xs text-slate-500">{item.plannedDate}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">{categoryName}</p>
                    {item.kind === "installment" ? (
                      <p className="text-xs text-slate-500">
                        Cartao: {cardName} - Fatura {item.statementMonthKey}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {formatCurrency(item.amountCents)}
                    </span>
                    <Button
                      variant="secondary"
                      onClick={() => handleMarkAsPaid(item)}
                      loading={payingId === item.id}
                      disabled={!canWrite}
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
              categoriesById.get(transaction.categoryId ?? "")?.name ??
              (transaction.categoryId ? "Categoria removida" : "Sem categoria");
            const cardInfo = transaction.cardId
              ? cardsById.get(transaction.cardId)
              : null;
            const cardName = transaction.cardId
              ? cardInfo?.name ?? "Cartao removido"
              : "";
            const isArchivedCard = Boolean(cardInfo?.archived);
            const badgeStyles =
              transaction.type === "income"
                ? "bg-emerald-100 text-emerald-700"
                : transaction.type === "expense"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-slate-200 text-slate-700";
            const typeLabel =
              transaction.type === "transfer"
                ? "Transferencia"
                : transaction.type === "income"
                  ? "Receita"
                  : "Despesa";
            const hasInstallment =
              transaction.installmentGroupId ||
              transaction.installmentPlanId ||
              transaction.installmentIndex ||
              transaction.installmentNumber;
            const installmentIndex =
              transaction.installmentIndex ?? transaction.installmentNumber ?? 1;
            const installmentCount =
              transaction.installmentCount ?? transaction.installmentsTotal ?? 1;
            const canEditTransaction =
              canWrite &&
              !hasInstallment &&
              transaction.type !== "transfer" &&
              !(transaction.paymentMethod === "card" && isArchivedCard);
            const canDeleteTransaction = canWrite && transaction.type !== "transfer";
            const primaryDescription =
              transaction.description?.trim() ||
              (transaction.type === "transfer" ? "Pagamento de fatura" : categoryName);
            const invoiceLabel =
              transaction.invoiceMonthKey ?? transaction.statementMonthKey ?? "-";

            return (
              <div
                key={transaction.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs ${badgeStyles}`}>
                      {typeLabel}
                    </span>
                    {transaction.sourceType === "recurring" ? (
                      <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">
                        Recorrente
                      </span>
                    ) : null}
                    {hasInstallment ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                        Parcela {installmentIndex}/{installmentCount}
                      </span>
                    ) : null}
                    {transaction.paidAt ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                        Pago
                      </span>
                    ) : null}
                    <span className="text-xs text-slate-500">{transaction.date}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {primaryDescription}
                  </p>
                  <p className="text-xs text-slate-500">{categoryName}</p>
                  {transaction.paymentMethod === "card" && transaction.cardId ? (
                    <p className="text-xs text-slate-500">
                      Cartao: {cardName} - Fatura {invoiceLabel}
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
                    disabled={!canEditTransaction}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="secondary"
                    className="border-rose-200 text-rose-600 hover:border-rose-300"
                    onClick={() => handleDelete(transaction)}
                    disabled={!canDeleteTransaction}
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
        cards={cards}
        initialValues={
          editing
            ? {
                type: editing.type === "transfer" ? "expense" : editing.type,
                paymentMethod: editing.paymentMethod,
                amountCents: editing.amountCents,
                date: editing.date,
                categoryId: editing.categoryId,
                description: editing.description,
                cardId: editing.cardId,
                statementMonthKey: editing.statementMonthKey,
              }
            : undefined
        }
        onSubmit={handleSave}
        onClose={closeModal}
        busy={saving}
        error={modalError}
        readOnly={!canWrite}
      />
    </AppShell>
  );
};

export default HomePage;

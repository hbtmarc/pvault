import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorBanner from "../components/ErrorBanner";
import SubtotalBar from "../components/SubtotalBar";
import { getDueDateISO, shiftMonthKey } from "../lib/date";
import { useMonthKey } from "../hooks/useMonthKey";
import {
  type Card as CardType,
  type Category,
  type FirestoreErrorInfo,
  type StatementPayment,
  type Transaction,
  clearStatementItemsPaid,
  createTransaction,
  deleteStatementPayment,
  fetchStatementTotal,
  getFirestoreErrorInfo,
  listCardTransactionsByStatement,
  listCards,
  listCategories,
  listenStatementPayment,
  markStatementItemsPaid,
  removeTransaction,
  upsertStatementPayment,
} from "../lib/firestore";
import { formatCurrency } from "../lib/money";
import { useAdmin } from "../providers/AdminProvider";

const resolveTransactionKind = (transaction: Transaction) =>
  transaction.kind ?? transaction.type;

const StatementsPage = () => {
  const { authUid, effectiveUid, isImpersonating } = useAdmin();
  const { monthKey } = useMonthKey();
  const canWrite = Boolean(authUid) && !isImpersonating;
  const [cards, setCards] = useState<CardType[]>([]);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [statement, setStatement] = useState<StatementPayment | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [archivedCategories, setArchivedCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [unpaying, setUnpaying] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [modalError, setModalError] = useState("");
  const [error, setError] = useState<FirestoreErrorInfo | null>(null);
  const [summaryTotals, setSummaryTotals] = useState<
    Array<{ monthKey: string; totalCents: number }>
  >([]);

  useEffect(() => {
    if (!effectiveUid) {
      return undefined;
    }

    const unsubscribe = listCards(
      effectiveUid,
      false,
      (items) => setCards(items),
      (err) => setError(getFirestoreErrorInfo(err))
    );

    return () => unsubscribe();
  }, [effectiveUid]);

  useEffect(() => {
    if (!cards.find((card) => card.id === selectedCardId)) {
      setSelectedCardId(cards[0]?.id ?? "");
    }
  }, [cards, selectedCardId]);

  useEffect(() => {
    if (!effectiveUid) {
      return undefined;
    }

    const unsubscribeActive = listCategories(
      effectiveUid,
      false,
      (items) => setCategories(items),
      (err) => setError(getFirestoreErrorInfo(err))
    );

    const unsubscribeArchived = listCategories(
      effectiveUid,
      true,
      (items) => setArchivedCategories(items),
      (err) => setError(getFirestoreErrorInfo(err))
    );

    return () => {
      unsubscribeActive();
      unsubscribeArchived();
    };
  }, [effectiveUid]);

  useEffect(() => {
    if (!effectiveUid || !selectedCardId) {
      return undefined;
    }

    setLoading(true);
    const unsubscribe = listCardTransactionsByStatement(
      effectiveUid,
      selectedCardId,
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
  }, [effectiveUid, selectedCardId, monthKey]);

  useEffect(() => {
    if (!effectiveUid || !selectedCardId) {
      setSummaryTotals([]);
      return;
    }

    const totalMonths = 6;
    const monthKeys = Array.from({ length: totalMonths }, (_, index) =>
      shiftMonthKey(monthKey, index)
    );

    Promise.all(
      monthKeys.map(async (key) => ({
        monthKey: key,
        totalCents: await fetchStatementTotal(effectiveUid, selectedCardId, key),
      }))
    )
      .then((items) => setSummaryTotals(items))
      .catch((err) => setError(getFirestoreErrorInfo(err)));
  }, [effectiveUid, selectedCardId, monthKey]);

  useEffect(() => {
    if (!effectiveUid || !selectedCardId) {
      return undefined;
    }

    const unsubscribe = listenStatementPayment(
      effectiveUid,
      selectedCardId,
      monthKey,
      (item) => setStatement(item),
      (err) => setError(getFirestoreErrorInfo(err))
    );

    return () => unsubscribe();
  }, [effectiveUid, selectedCardId, monthKey]);


  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>();
    [...categories, ...archivedCategories].forEach((category) => {
      map.set(category.id, category);
    });
    return map;
  }, [categories, archivedCategories]);

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? null,
    [cards, selectedCardId]
  );

  const displayTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) => resolveTransactionKind(transaction) !== "transfer"
      ),
    [transactions]
  );

  const statementTotal = useMemo(
    () =>
      displayTransactions.reduce((sum, transaction) => {
        const kind = resolveTransactionKind(transaction);
        if (kind === "income") {
          return sum - transaction.amountCents;
        }
        if (kind === "expense") {
          return sum + transaction.amountCents;
        }
        return sum;
      }, 0),
    [displayTransactions]
  );

  const isPaid = Boolean(statement);
  const canPay = canWrite && !isPaid && statementTotal > 0 && Boolean(selectedCard);
  const canUnpay = canWrite && isPaid && Boolean(selectedCard);

  const openPaymentModal = () => {
    if (!selectedCard || !canPay) {
      return;
    }
    setPaymentDate(getDueDateISO(monthKey, selectedCard.dueDay));
    setPaymentNotes("");
    setModalError("");
    setModalOpen(true);
  };

  const closePaymentModal = () => {
    if (paying) {
      return;
    }
    setModalOpen(false);
  };

  const handlePayStatement = async () => {
    if (!authUid || !selectedCard || !canPay) {
      return;
    }

    if (!paymentDate) {
      setModalError("Informe a data do pagamento.");
      return;
    }

    try {
      setPaying(true);
      setModalError("");

      const paymentName = `Pagamento fatura ${selectedCard.name} ${monthKey}`;
      const tx = await createTransaction(authUid, {
        type: "transfer",
        paymentMethod: "cash",
        amountCents: statementTotal,
        date: paymentDate,
        description: paymentName,
        name: paymentName,
        notes: paymentNotes.trim() ? paymentNotes.trim() : undefined,
        paymentKind: "card_payment",
        cardId: selectedCard.id,
        statementMonthKey: monthKey,
      });

      await upsertStatementPayment(authUid, selectedCard.id, monthKey, {
        paidAt: paymentDate,
        paidAmountCents: statementTotal,
        paymentTxId: tx.id,
        snapshotTotalCents: statementTotal,
        notes: paymentNotes.trim() ? paymentNotes.trim() : undefined,
      });

      await markStatementItemsPaid(
        authUid,
        selectedCard.id,
        monthKey,
        paymentDate,
        `${selectedCard.id}_${monthKey}`
      );

      setModalOpen(false);
    } catch (err) {
      setModalError(getFirestoreErrorInfo(err).message);
    } finally {
      setPaying(false);
    }
  };

  const handleUnpayStatement = async () => {
    if (!authUid || !selectedCard || !canUnpay) {
      return;
    }

    const confirmed = window.confirm("Desmarcar fatura como paga?");
    if (!confirmed) {
      return;
    }

    try {
      setUnpaying(true);
      if (statement?.paymentTxId) {
        await removeTransaction(authUid, statement.paymentTxId);
      }
      await deleteStatementPayment(authUid, selectedCard.id, monthKey);
      await clearStatementItemsPaid(authUid, selectedCard.id, monthKey);
    } catch (err) {
      setError(getFirestoreErrorInfo(err));
    } finally {
      setUnpaying(false);
    }
  };

  return (
    <AppShell
      title="Faturas"
      subtitle="Acompanhe seus ciclos de cartao"
      toolbarSlot={
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Cartao</span>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={selectedCardId}
            onChange={(event) => setSelectedCardId(event.target.value)}
            disabled={cards.length === 0}
          >
            {cards.length === 0 ? (
              <option value="">Nenhum cartao cadastrado</option>
            ) : null}
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <ErrorBanner info={error} className="mt-4" />

      {!selectedCard ? (
        <Card className="mt-6">
          <p className="text-sm text-slate-500">
            Cadastre um cartao para visualizar faturas.
          </p>
        </Card>
      ) : (
        <>
          <Card className="mt-6">
            <h2 className="text-lg font-semibold text-slate-900">Resumo das faturas</h2>
            <p className="text-sm text-slate-500">
              Total do mes atual e proximos 5 meses.
            </p>

            {summaryTotals.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Carregando resumo...</p>
            ) : null}

            <div className="mt-4 space-y-2">
              {summaryTotals.map((item) => (
                <div
                  key={item.monthKey}
                  className="flex items-center justify-between text-sm text-slate-700"
                >
                  <span>{item.monthKey}</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(item.totalCents)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

        <Card className="mt-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Fatura {monthKey}
              </h2>
              <p className="text-sm text-slate-500">
                {selectedCard.name} - Fecha dia {selectedCard.closingDay} - Vence dia{" "}
                {selectedCard.dueDay}
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <span className="text-sm text-slate-500">Total da fatura</span>
              <span className="text-2xl font-bold text-slate-900">
                {formatCurrency(statementTotal)}
              </span>
              <span
                className={`rounded-full px-2 py-1 text-xs ${
                  isPaid ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
                }`}
              >
                {isPaid ? "Paga" : "Aberta"}
              </span>
              {statement?.paidAt ? (
                <span className="text-xs text-slate-500">
                  Pago em {statement.paidAt}
                </span>
              ) : null}
            </div>
          </div>

          {statementTotal <= 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Nenhum valor pendente para pagamento.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={openPaymentModal} disabled={!canPay}>
              Marcar fatura como paga
            </Button>
            {isPaid ? (
              <Button
                variant="secondary"
                onClick={handleUnpayStatement}
                loading={unpaying}
                disabled={!canUnpay}
              >
                Desmarcar como paga
              </Button>
            ) : null}
          </div>

          {loading ? (
            <p className="mt-6 text-sm text-slate-500">Carregando itens...</p>
          ) : null}

          {!loading && displayTransactions.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">
              Nenhum lancamento nesta fatura.
            </p>
          ) : null}

          <div className="mt-6 space-y-3">
            {displayTransactions.map((transaction) => {
              const kind = resolveTransactionKind(transaction);
              const categoryName =
                categoriesById.get(transaction.categoryId ?? "")?.name ??
                (transaction.categoryId ? "Categoria removida" : "Sem categoria");
              const badgeStyles =
                kind === "income"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-rose-100 text-rose-700";
              const hasInstallment =
                transaction.installmentGroupId ||
                transaction.installmentPlanId ||
                transaction.installmentIndex ||
                transaction.installmentNumber;
              const installmentIndex =
                transaction.installmentIndex ?? transaction.installmentNumber ?? 1;
              const installmentCount =
                transaction.installmentCount ?? transaction.installmentsTotal ?? 1;
              const primaryDescription =
                transaction.description?.trim() || "Sem descricao";

              return (
                <div
                  key={transaction.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs ${badgeStyles}`}>
                        {kind === "income" ? "Receita" : "Despesa"}
                      </span>
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
                </div>
                <span className="text-sm font-semibold text-slate-900">
                  {formatCurrency(transaction.amountCents)}
                </span>
              </div>
              );
            })}
          </div>

          <SubtotalBar
            title="Subtotal da fatura"
            itemsCount={displayTransactions.length}
            totalCents={statementTotal}
          />
        </Card>
        </>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Marcar fatura como paga
              </h2>
              <button
                type="button"
                onClick={closePaymentModal}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Fechar
              </button>
            </div>

            {modalError ? (
              <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                {modalError}
              </div>
            ) : null}

            <div className="space-y-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Data do pagamento</span>
                <input
                  type="date"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Observacao</span>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={paymentNotes}
                  onChange={(event) => setPaymentNotes(event.target.value)}
                  placeholder="Opcional"
                />
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button type="button" variant="secondary" onClick={closePaymentModal}>
                Cancelar
              </Button>
              <Button onClick={handlePayStatement} loading={paying}>
                Confirmar pagamento
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
};

export default StatementsPage;

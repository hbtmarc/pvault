import { type FormEvent, useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorBanner from "../components/ErrorBanner";
import Input from "../components/Input";
import MonthSelector from "../components/MonthSelector";
import { getMonthKey } from "../lib/date";
import {
  type Card as CardType,
  type FirestoreErrorInfo,
  type Transaction,
  archiveCard,
  createCard,
  getFirestoreErrorInfo,
  getFirestoreErrorMessage,
  listCardTransactionsByStatementMonth,
  listCards,
  updateCard,
} from "../lib/firestore";
import { formatCentsToInput, formatCurrency, parseBRLToCents } from "../lib/money";
import { useAdmin } from "../providers/AdminProvider";

const CardsPage = () => {
  const { authUid, effectiveUid, isImpersonating } = useAdmin();
  const canWrite = Boolean(authUid) && !isImpersonating;
  const [monthKey, setMonthKey] = useState(getMonthKey(new Date()));
  const [cards, setCards] = useState<CardType[]>([]);
  const [archivedCards, setArchivedCards] = useState<CardType[]>([]);
  const [statementTransactions, setStatementTransactions] = useState<Transaction[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreErrorInfo | null>(null);

  const [name, setName] = useState("");
  const [closingDay, setClosingDay] = useState("10");
  const [dueDay, setDueDay] = useState("5");
  const [limit, setLimit] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingClosingDay, setEditingClosingDay] = useState("10");
  const [editingDueDay, setEditingDueDay] = useState("5");
  const [editingLimit, setEditingLimit] = useState("");
  const [editingLoading, setEditingLoading] = useState(false);
  const [editingError, setEditingError] = useState("");

  useEffect(() => {
    if (!effectiveUid) {
      return undefined;
    }

    setLoading(true);
    const unsubscribeActive = listCards(
      effectiveUid,
      false,
      (items) => {
        setCards(items);
        setLoading(false);
      },
      (err) => {
        setError(getFirestoreErrorInfo(err));
        setLoading(false);
      }
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

    const unsubscribe = listCardTransactionsByStatementMonth(
      effectiveUid,
      monthKey,
      (items) => setStatementTransactions(items),
      (err) => setError(getFirestoreErrorInfo(err))
    );

    return () => unsubscribe();
  }, [effectiveUid, monthKey]);

  const statementTotals = useMemo(() => {
    const totals = new Map<string, number>();
    statementTransactions.forEach((transaction) => {
      if (!transaction.cardId) {
        return;
      }
      if (transaction.type === "transfer") {
        return;
      }
      const current = totals.get(transaction.cardId) ?? 0;
      const delta =
        transaction.type === "income"
          ? -transaction.amountCents
          : transaction.amountCents;
      totals.set(transaction.cardId, current + delta);
    });
    return totals;
  }, [statementTransactions]);

  const validateDays = (closing: number, due: number) => {
    if (!Number.isInteger(closing) || closing < 1 || closing > 31) {
      return "Dia de fechamento deve estar entre 1 e 31.";
    }
    if (!Number.isInteger(due) || due < 1 || due > 31) {
      return "Dia de vencimento deve estar entre 1 e 31.";
    }
    return "";
  };

  const parseLimit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = parseBRLToCents(trimmed);
    if (parsed === null) {
      return null;
    }
    return parsed;
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authUid || !canWrite) {
      return;
    }

    if (!name.trim()) {
      setFormError("Informe um nome para o cartao.");
      return;
    }

    const closingValue = Number(closingDay);
    const dueValue = Number(dueDay);
    const daysError = validateDays(closingValue, dueValue);
    if (daysError) {
      setFormError(daysError);
      return;
    }

    const limitCents = parseLimit(limit);
    if (limitCents === null) {
      setFormError("Informe um limite valido.");
      return;
    }

    try {
      setCreating(true);
      setFormError("");
      await createCard(authUid, {
        name: name.trim(),
        closingDay: closingValue,
        dueDay: dueValue,
        limitCents,
      });
      setName("");
      setLimit("");
    } catch (err) {
      setFormError(getFirestoreErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const startEditing = (card: CardType) => {
    if (!canWrite) {
      return;
    }
    setEditingId(card.id);
    setEditingName(card.name);
    setEditingClosingDay(card.closingDay.toString());
    setEditingDueDay(card.dueDay.toString());
    setEditingLimit(
      card.limitCents !== undefined ? formatCentsToInput(card.limitCents) : ""
    );
    setEditingError("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName("");
    setEditingClosingDay("10");
    setEditingDueDay("5");
    setEditingLimit("");
    setEditingError("");
  };

  const handleSave = async () => {
    if (!authUid || !editingId || !canWrite) {
      return;
    }

    if (!editingName.trim()) {
      setEditingError("Informe um nome valido.");
      return;
    }

    const closingValue = Number(editingClosingDay);
    const dueValue = Number(editingDueDay);
    const daysError = validateDays(closingValue, dueValue);
    if (daysError) {
      setEditingError(daysError);
      return;
    }

    const limitCents = parseLimit(editingLimit);
    if (limitCents === null) {
      setEditingError("Informe um limite valido.");
      return;
    }

    try {
      setEditingLoading(true);
      setEditingError("");
      await updateCard(authUid, editingId, {
        name: editingName.trim(),
        closingDay: closingValue,
        dueDay: dueValue,
        limitCents,
      });
      cancelEditing();
    } catch (err) {
      setEditingError(getFirestoreErrorMessage(err));
    } finally {
      setEditingLoading(false);
    }
  };

  const handleArchive = async (cardId: string, archived: boolean) => {
    if (!authUid || !canWrite) {
      return;
    }

    try {
      await archiveCard(authUid, cardId, archived);
    } catch (err) {
      setError(getFirestoreErrorInfo(err));
    }
  };

  return (
    <AppShell title="Cartoes" subtitle="Gerencie seus cartoes de credito">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <MonthSelector monthKey={monthKey} onChange={setMonthKey} />
        <span className="text-sm text-slate-500">
          Fatura do mes: {monthKey}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Novo cartao</h2>
          <p className="text-sm text-slate-500">
            Use o dia de fechamento para calcular a fatura correta.
          </p>

          {formError ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {formError}
            </div>
          ) : null}

          <form className="mt-4 space-y-4" onSubmit={handleCreate}>
            <Input
              label="Nome"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Nubank, Itau"
              disabled={!canWrite}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Dia de fechamento</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={closingDay}
                  onChange={(event) => setClosingDay(event.target.value)}
                  disabled={!canWrite}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Dia de vencimento</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={dueDay}
                  onChange={(event) => setDueDay(event.target.value)}
                  disabled={!canWrite}
                />
              </label>
            </div>

            <Input
              label="Limite (opcional)"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              placeholder="0,00"
              disabled={!canWrite}
            />

            <Button type="submit" className="w-full" loading={creating} disabled={!canWrite}>
              Criar cartao
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Cartoes ativos</h2>
          <p className="text-sm text-slate-500">
            Edite ou arquive quando nao usar mais.
          </p>

          <ErrorBanner info={error} className="mt-4" />

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Carregando...</p>
          ) : null}

          {!loading && cards.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Nenhum cartao cadastrado ainda.
            </p>
          ) : null}

          <div className="mt-4 space-y-3">
            {cards.map((card) => {
              const statementTotal = statementTotals.get(card.id) ?? 0;
              const limitCents = card.limitCents;
              const available =
                limitCents !== undefined ? limitCents - statementTotal : null;
              const usagePercent =
                limitCents && limitCents > 0
                  ? Math.max(
                      0,
                      Math.min(100, Math.round((statementTotal / limitCents) * 100))
                    )
                  : 0;

              return (
                <div
                  key={card.id}
                  className="rounded-xl border border-slate-100 bg-white px-4 py-3"
                >
                  {editingId === card.id ? (
                    <div className="space-y-3">
                      {editingError ? (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                          {editingError}
                        </div>
                      ) : null}
                      <Input
                        label="Nome"
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        disabled={!canWrite}
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="flex flex-col gap-1 text-sm">
                          <span className="font-medium text-slate-700">
                            Dia de fechamento
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            value={editingClosingDay}
                            onChange={(event) => setEditingClosingDay(event.target.value)}
                            disabled={!canWrite || editingLoading}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                          <span className="font-medium text-slate-700">
                            Dia de vencimento
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            value={editingDueDay}
                            onChange={(event) => setEditingDueDay(event.target.value)}
                            disabled={!canWrite || editingLoading}
                          />
                        </label>
                      </div>
                      <Input
                        label="Limite (opcional)"
                        value={editingLimit}
                        onChange={(event) => setEditingLimit(event.target.value)}
                        disabled={!canWrite || editingLoading}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={handleSave}
                          loading={editingLoading}
                          disabled={!canWrite}
                        >
                          Salvar
                        </Button>
                        <Button
                          variant="secondary"
                          type="button"
                          onClick={cancelEditing}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {card.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Fecha dia {card.closingDay} - Vence dia {card.dueDay}
                        </p>
                        {limitCents !== undefined ? (
                          <p className="text-xs text-slate-500">
                            Limite: {formatCurrency(limitCents)}
                          </p>
                        ) : null}
                        <p className="text-xs text-slate-500">
                          Total fatura {monthKey}: {formatCurrency(statementTotal)}
                        </p>
                        {limitCents !== undefined ? (
                          <p className="text-xs text-slate-500">
                            Disponivel: {formatCurrency(available ?? 0)} - Uso:{" "}
                            {usagePercent}%
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => startEditing(card)}
                          disabled={!canWrite}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="secondary"
                          className="border-rose-200 text-rose-600 hover:border-rose-300"
                          onClick={() => handleArchive(card.id, true)}
                          disabled={!canWrite}
                        >
                          Arquivar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900">Arquivados</h2>
        <p className="text-sm text-slate-500">Reative quando precisar.</p>

        {archivedCards.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nenhum cartao arquivado.</p>
        ) : null}

        <div className="mt-4 space-y-3">
          {archivedCards.map((card) => (
            <div
              key={card.id}
              className="rounded-xl border border-slate-100 bg-white px-4 py-3"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{card.name}</p>
                  <p className="text-xs text-slate-500">
                    Fecha dia {card.closingDay} - Vence dia {card.dueDay}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => handleArchive(card.id, false)}
                  disabled={!canWrite}
                >
                  Reativar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
};

export default CardsPage;

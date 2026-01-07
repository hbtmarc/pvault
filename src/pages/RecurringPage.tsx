import { type FormEvent, useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorBanner from "../components/ErrorBanner";
import MonthSelector from "../components/MonthSelector";
import { getMonthKey } from "../lib/date";
import { useMonthKey } from "../hooks/useMonthKey";
import {
  type Category,
  type Direction,
  type FirestoreErrorInfo,
  type RecurringRule,
  type Transaction,
  buildPlannedItems,
  createRecurringRule,
  deleteRecurringRule,
  getFirestoreErrorInfo,
  listCategories,
  listRecurringRules,
  listTransactionsByMonth,
  toggleRecurringRule,
  updateRecurringRule,
} from "../lib/firestore";
import { formatCentsToInput, formatCurrency, parseBRLToCents } from "../lib/money";
import { useAdmin } from "../providers/AdminProvider";

const directionLabels: Record<Direction, string> = {
  income: "Receita",
  expense: "Despesa",
};

const RecurringPage = () => {
  const { authUid, effectiveUid, isImpersonating } = useAdmin();
  const { monthKey, setMonthKey } = useMonthKey();
  const canWrite = Boolean(authUid) && !isImpersonating;
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<FirestoreErrorInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDirection, setFormDirection] = useState<Direction>("expense");
  const [formAmount, setFormAmount] = useState("");
  const [formDay, setFormDay] = useState("1");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formStartMonthKey, setFormStartMonthKey] = useState(getMonthKey(new Date()));
  const [formEndMonthKey, setFormEndMonthKey] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

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

    const unsubscribe = listRecurringRules(
      effectiveUid,
      (items) => {
        setRules(items);
        setLoading(false);
      },
      (err) => {
        setError(getFirestoreErrorInfo(err));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [effectiveUid]);

  useEffect(() => {
    if (!effectiveUid) {
      return undefined;
    }

    const unsubscribe = listTransactionsByMonth(
      effectiveUid,
      monthKey,
      (items) => setTransactions(items),
      (err) => setError(getFirestoreErrorInfo(err))
    );

    return () => unsubscribe();
  }, [effectiveUid, monthKey]);

  const availableCategories = useMemo(
    () => categories.filter((category) => category.type === formDirection),
    [categories, formDirection]
  );

  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((category) => {
      map.set(category.id, category);
    });
    return map;
  }, [categories]);

  useEffect(() => {
    if (availableCategories.length === 0) {
      setFormCategoryId("");
      return;
    }

    if (!availableCategories.find((category) => category.id === formCategoryId)) {
      setFormCategoryId(availableCategories[0]?.id ?? "");
    }
  }, [availableCategories, formCategoryId]);

  const plannedItems = useMemo(
    () => buildPlannedItems(monthKey, rules, transactions),
    [monthKey, rules, transactions]
  );

  const resetForm = () => {
    setEditingId(null);
    setFormName("");
    setFormDirection("expense");
    setFormAmount("");
    setFormDay("1");
    setFormCategoryId("");
    setFormStartMonthKey(getMonthKey(new Date()));
    setFormEndMonthKey("");
    setFormError("");
  };

  const startEditing = (rule: RecurringRule) => {
    if (!canWrite) {
      return;
    }
    setEditingId(rule.id);
    setFormName(rule.name);
    setFormDirection(rule.direction);
    setFormAmount(formatCentsToInput(rule.amountCents));
    setFormDay(rule.dayOfMonth.toString());
    setFormCategoryId(rule.categoryId);
    setFormStartMonthKey(rule.startMonthKey);
    setFormEndMonthKey(rule.endMonthKey ?? "");
    setFormError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authUid || !canWrite) {
      return;
    }

    if (!formName.trim()) {
      setFormError("Informe um nome para a recorrencia.");
      return;
    }

    const amountCents = parseBRLToCents(formAmount);
    if (!amountCents || amountCents <= 0) {
      setFormError("Informe um valor valido.");
      return;
    }

    const dayValue = Number(formDay);
    if (!Number.isInteger(dayValue) || dayValue < 1 || dayValue > 31) {
      setFormError("Dia do mes precisa estar entre 1 e 31.");
      return;
    }

    if (!formCategoryId) {
      setFormError("Selecione uma categoria.");
      return;
    }

    if (!formStartMonthKey) {
      setFormError("Informe o mes de inicio.");
      return;
    }

    if (formEndMonthKey && formEndMonthKey < formStartMonthKey) {
      setFormError("Mes final precisa ser maior ou igual ao mes inicial.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const payload = {
        name: formName.trim(),
        direction: formDirection,
        amountCents,
        categoryId: formCategoryId,
        dayOfMonth: dayValue,
        startMonthKey: formStartMonthKey,
        endMonthKey: formEndMonthKey || undefined,
      };

      if (editingId) {
        await updateRecurringRule(authUid, editingId, payload);
      } else {
        await createRecurringRule(authUid, payload);
      }

      resetForm();
    } catch (err) {
      setFormError(getFirestoreErrorInfo(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: RecurringRule) => {
    if (!authUid || !canWrite) {
      return;
    }

    try {
      await toggleRecurringRule(authUid, rule.id, !rule.active);
    } catch (err) {
      setError(getFirestoreErrorInfo(err));
    }
  };

  const handleDelete = async (rule: RecurringRule) => {
    if (!authUid || !canWrite) {
      return;
    }

    const confirmed = window.confirm("Excluir esta recorrencia?");
    if (!confirmed) {
      return;
    }

    try {
      await deleteRecurringRule(authUid, rule.id);
    } catch (err) {
      setError(getFirestoreErrorInfo(err));
    }
  };

  return (
    <AppShell title="Recorrencias" subtitle="Lancamentos mensais automaticos">
      <Card>
        <h2 className="text-lg font-semibold text-slate-900">
          {editingId ? "Editar recorrencia" : "Nova recorrencia"}
        </h2>
        <p className="text-sm text-slate-500">
          Configure entradas e saidas mensais para aparecerem como previstos.
        </p>

        {formError ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {formError}
          </div>
        ) : null}

        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Nome</span>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={formName}
              onChange={(event) => setFormName(event.target.value)}
              placeholder="Ex: Aluguel, Salario"
              disabled={!canWrite}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Tipo</span>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={formDirection}
              onChange={(event) => setFormDirection(event.target.value as Direction)}
              disabled={!canWrite}
            >
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Valor</span>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={formAmount}
              onChange={(event) => setFormAmount(event.target.value)}
              placeholder="0,00"
              disabled={!canWrite}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Dia do mes</span>
            <input
              type="number"
              min={1}
              max={31}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={formDay}
              onChange={(event) => setFormDay(event.target.value)}
              disabled={!canWrite}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Categoria</span>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={formCategoryId}
              onChange={(event) => setFormCategoryId(event.target.value)}
              disabled={!canWrite}
            >
              {availableCategories.length === 0 ? (
                <option value="">Nenhuma categoria disponivel</option>
              ) : null}
              {availableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Mes inicial</span>
            <input
              type="month"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={formStartMonthKey}
              onChange={(event) => setFormStartMonthKey(event.target.value)}
              disabled={!canWrite}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Mes final (opcional)</span>
            <input
              type="month"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={formEndMonthKey}
              onChange={(event) => setFormEndMonthKey(event.target.value)}
              disabled={!canWrite}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2 md:col-span-2">
            <Button type="submit" loading={saving} disabled={!canWrite}>
              {editingId ? "Salvar" : "Criar recorrencia"}
            </Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      <ErrorBanner info={error} className="mt-6" />

      <Card className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900">Regras criadas</h2>
        <p className="text-sm text-slate-500">
          Ative, edite ou exclua quando necessario.
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Carregando...</p>
        ) : null}

        {!loading && rules.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Nenhuma recorrencia cadastrada.
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="rounded-xl border border-slate-100 bg-white px-4 py-3"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        rule.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {rule.active ? "Ativa" : "Inativa"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {directionLabels[rule.direction]}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{rule.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatCurrency(rule.amountCents)} - dia {rule.dayOfMonth}
                  </p>
                  <p className="text-xs text-slate-500">
                    Categoria: {categoriesById.get(rule.categoryId)?.name ?? "-"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {rule.startMonthKey}
                    {rule.endMonthKey ? ` ate ${rule.endMonthKey}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => startEditing(rule)}
                    disabled={!canWrite}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleToggle(rule)}
                    disabled={!canWrite}
                  >
                    {rule.active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    variant="secondary"
                    className="border-rose-200 text-rose-600 hover:border-rose-300"
                    onClick={() => handleDelete(rule)}
                    disabled={!canWrite}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Previstos</h2>
            <p className="text-sm text-slate-500">
              Preview do mes selecionado, sem gravar no Firestore.
            </p>
          </div>
          <MonthSelector monthKey={monthKey} onChange={setMonthKey} />
        </div>

        {plannedItems.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nenhum previsto para este mes.</p>
        ) : null}

        <div className="mt-4 space-y-3">
          {plannedItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">
                    Previsto
                  </span>
                  <span className="text-xs text-slate-500">{item.plannedDate}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">
                  {categoriesById.get(item.categoryId)?.name ?? "Categoria removida"}
                </p>
              </div>
              <span className="text-sm font-semibold text-slate-900">
                {formatCurrency(item.amountCents)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
};

export default RecurringPage;

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { getStatementMonthKey, todayDateInput } from "../lib/date";
import { formatCentsToInput, parseAmountToCents } from "../lib/money";
import type { Card, Category, Direction, PaymentMethod } from "../lib/firestore";
import Button from "./Button";

export type TransactionDraft = {
  type: Direction;
  paymentMethod: PaymentMethod;
  amountCents: number;
  date: string;
  categoryId?: string;
  description?: string;
  cardId?: string;
  statementMonthKey?: string;
  installments?: number;
};

type TransactionFormModalProps = {
  open: boolean;
  title: string;
  submitLabel: string;
  categories: Category[];
  cards: Card[];
  initialValues?: TransactionDraft;
  onSubmit: (values: TransactionDraft) => Promise<void>;
  onClose: () => void;
  busy?: boolean;
  error?: string;
  readOnly?: boolean;
};

type FormErrors = {
  amount?: string;
  date?: string;
  categoryId?: string;
  form?: string;
};

const TransactionFormModal = ({
  open,
  title,
  submitLabel,
  categories,
  cards,
  initialValues,
  onSubmit,
  onClose,
  busy,
  error,
  readOnly,
}: TransactionFormModalProps) => {
  const [type, setType] = useState<Direction>("expense");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayDateInput());
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [cardId, setCardId] = useState("");
  const [isInstallment, setIsInstallment] = useState(false);
  const [installments, setInstallments] = useState("2");
  const [errors, setErrors] = useState<FormErrors>({});

  const availableCategories = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type]
  );

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === cardId),
    [cards, cardId]
  );

  const statementMonthKey =
    paymentMethod === "card" && cardId && date
      ? getStatementMonthKey(date, selectedCard?.closingDay ?? 1)
      : "";

  const canInstall = paymentMethod === "card" && type === "expense";

  useEffect(() => {
    if (!open) {
      return;
    }

    if (initialValues) {
      setType(initialValues.type);
      setPaymentMethod(initialValues.paymentMethod ?? "cash");
      setAmount(formatCentsToInput(initialValues.amountCents));
      setDate(initialValues.date);
      setCategoryId(initialValues.categoryId ?? "");
      setDescription(initialValues.description ?? "");
      setCardId(initialValues.cardId ?? "");
      setIsInstallment(Boolean(initialValues.installments && initialValues.installments > 1));
      setInstallments(
        initialValues.installments ? initialValues.installments.toString() : "2"
      );
    } else {
      setType("expense");
      setPaymentMethod("cash");
      setAmount("");
      setDate(todayDateInput());
      setCategoryId("");
      setDescription("");
      setCardId("");
      setIsInstallment(false);
      setInstallments("2");
    }

    setErrors({});
  }, [open, initialValues]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!availableCategories.find((category) => category.id === categoryId)) {
      setCategoryId(availableCategories[0]?.id ?? "");
    }
  }, [availableCategories, categoryId, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (paymentMethod !== "card") {
      setCardId("");
      setIsInstallment(false);
      return;
    }

    if (!cards.find((card) => card.id === cardId)) {
      setCardId(cards[0]?.id ?? "");
    }
  }, [cards, cardId, open, paymentMethod]);

  useEffect(() => {
    if (!canInstall && isInstallment) {
      setIsInstallment(false);
    }
  }, [canInstall, isInstallment]);

  if (!open) {
    return null;
  }

  const isDisabled = Boolean(busy || readOnly);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (readOnly) {
      return;
    }

    const nextErrors: FormErrors = {};
    const amountCents = parseAmountToCents(amount);

    if (!amountCents || amountCents <= 0) {
      nextErrors.amount = "Informe um valor valido.";
    }

    if (!date) {
      nextErrors.date = "Informe uma data.";
    }

    if (!categoryId) {
      nextErrors.categoryId = "Selecione uma categoria.";
    }

    if (availableCategories.length === 0) {
      nextErrors.categoryId = "Crie uma categoria antes de lancar.";
    }

    if (paymentMethod === "card" && !cardId) {
      nextErrors.form = "Selecione um cartao para lancar.";
    }

    const installmentsValue = Number(installments);
    if (isInstallment) {
      if (
        !Number.isInteger(installmentsValue) ||
        installmentsValue < 2 ||
        installmentsValue > 24
      ) {
        nextErrors.form = "Parcelas devem estar entre 2 e 24.";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    await onSubmit({
      type,
      paymentMethod,
      amountCents: amountCents ?? 0,
      date,
      categoryId,
      description: description.trim() ? description.trim() : undefined,
      cardId: paymentMethod === "card" ? cardId || undefined : undefined,
      statementMonthKey:
        paymentMethod === "card" ? statementMonthKey || undefined : undefined,
      installments: isInstallment ? installmentsValue : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Fechar
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        {errors.form ? (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {errors.form}
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Tipo</span>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={type}
              onChange={(event) => setType(event.target.value as Direction)}
              disabled={isDisabled}
            >
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Forma de pagamento</span>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(event.target.value as PaymentMethod)
              }
              disabled={isDisabled}
            >
              <option value="cash">Dinheiro / Debito / Pix</option>
              <option value="card">Cartao</option>
            </select>
          </label>

          {paymentMethod === "card" ? (
            <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Cartao</span>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={cardId}
                  onChange={(event) => setCardId(event.target.value)}
                  disabled={isDisabled || cards.length === 0}
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

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={isInstallment}
                    onChange={(event) => setIsInstallment(event.target.checked)}
                    disabled={isDisabled || !canInstall}
                  />
                  Parcelar?
                </label>
                {isInstallment ? (
                  <input
                    type="number"
                    min={2}
                    max={24}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={installments}
                    onChange={(event) => setInstallments(event.target.value)}
                    disabled={isDisabled}
                  />
                ) : null}
              </div>

              {statementMonthKey ? (
                <p className="text-xs text-slate-500">
                  Esta compra caira na fatura de {statementMonthKey}.
                </p>
              ) : null}
            </div>
          ) : null}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Valor</span>
            <input
              className={`w-full rounded-lg border px-3 py-2 text-sm ${
                errors.amount ? "border-rose-400" : "border-slate-200"
              }`}
              placeholder="0,00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={isDisabled}
            />
            {errors.amount ? (
              <span className="text-xs text-rose-500">{errors.amount}</span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Data</span>
            <input
              type="date"
              className={`w-full rounded-lg border px-3 py-2 text-sm ${
                errors.date ? "border-rose-400" : "border-slate-200"
              }`}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              disabled={isDisabled}
            />
            {errors.date ? (
              <span className="text-xs text-rose-500">{errors.date}</span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Categoria</span>
            <select
              className={`w-full rounded-lg border px-3 py-2 text-sm ${
                errors.categoryId ? "border-rose-400" : "border-slate-200"
              }`}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={isDisabled || availableCategories.length === 0}
            >
              {availableCategories.length === 0 ? (
                <option value="">Nenhuma categoria do tipo selecionado</option>
              ) : null}
              {availableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.categoryId ? (
              <span className="text-xs text-rose-500">{errors.categoryId}</span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Descricao (opcional)</span>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isDisabled}
            />
          </label>

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy} disabled={isDisabled}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionFormModal;

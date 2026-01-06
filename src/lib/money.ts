const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const formatCurrency = (amountCents: number) =>
  currencyFormatter.format(amountCents / 100);

export const formatCentsToInput = (amountCents: number) =>
  (amountCents / 100).toFixed(2);

export const parseAmountToCents = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const cleaned = trimmed.replace(/[^0-9,.-]/g, "");
  if (!cleaned) {
    return null;
  }

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const separatorIndex = Math.max(lastComma, lastDot);

  let integerPart = cleaned;
  let decimalPart = "";

  if (separatorIndex >= 0) {
    integerPart = cleaned.slice(0, separatorIndex);
    decimalPart = cleaned.slice(separatorIndex + 1);
  }

  integerPart = integerPart.replace(/[.,]/g, "");
  decimalPart = decimalPart.replace(/[.,]/g, "");

  const combined = decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
  const amount = Number(combined);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return Math.round(amount * 100);
};

export const parseBRLToCents = (raw: string) => parseAmountToCents(raw);

export const formatCentsToBRL = (amountCents: number) =>
  formatCurrency(amountCents);
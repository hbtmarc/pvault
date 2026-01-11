const stripToNumber = (value: string) =>
  value.replace(/[^\d,.\-()]/g, "").replace(/\s+/g, "");

const parseSign = (value: string) => {
  if (value.includes("(") && value.includes(")")) {
    return -1;
  }
  return value.includes("-") ? -1 : 1;
};

export const parseMoneyToCents = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const cleaned = stripToNumber(trimmed);
  if (!cleaned) {
    return null;
  }

  const sign = parseSign(cleaned);
  const normalized = cleaned.replace(/[()-]/g, "");

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  const separatorIndex = Math.max(lastComma, lastDot);

  let integerPart = normalized;
  let decimalPart = "";

  if (separatorIndex >= 0) {
    integerPart = normalized.slice(0, separatorIndex);
    decimalPart = normalized.slice(separatorIndex + 1);
  }

  integerPart = integerPart.replace(/[.,]/g, "");
  decimalPart = decimalPart.replace(/[.,]/g, "");

  const combined = decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
  const amount = Number(combined);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return Math.round(amount * 100) * sign;
};

export type InstallmentParseResult = {
  baseDescription: string;
  installmentIndex: number;
  installmentTotal: number;
  installmentTagOriginal: string;
};

const cleanDescription = (value: string) =>
  value
    .replace(/[\(\)\[\]]/g, " ")
    .replace(/[-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const INSTALLMENT_PATTERNS: RegExp[] = [
  /\bparc(?:ela)?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i,
  /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/i,
  /\b(\d{1,2})\s+de\s+(\d{1,2})\b/i,
];

export const parseInstallments = (
  description: string | undefined | null
): InstallmentParseResult | null => {
  const value = description?.trim();
  if (!value) {
    return null;
  }

  for (const pattern of INSTALLMENT_PATTERNS) {
    const match = value.match(pattern);
    if (!match) {
      continue;
    }

    const installmentIndex = Number(match[1]);
    const installmentTotal = Number(match[2]);
    if (
      !Number.isInteger(installmentIndex) ||
      !Number.isInteger(installmentTotal) ||
      installmentTotal <= 1 ||
      installmentIndex < 1 ||
      installmentIndex > installmentTotal
    ) {
      continue;
    }

    const installmentTagOriginal = match[0].trim();
    const withoutTag = cleanDescription(value.replace(match[0], " "));
    const baseDescription = withoutTag || cleanDescription(value);

    return {
      baseDescription,
      installmentIndex,
      installmentTotal,
      installmentTagOriginal,
    };
  }

  return null;
};

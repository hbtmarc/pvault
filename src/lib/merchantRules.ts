import { normalizeText } from "./normalizeText";

export const buildMerchantKey = (value: string | undefined | null) => {
  const normalized = normalizeText(value ?? "");
  if (!normalized) {
    return "";
  }
  return normalized.replace(/\s+/g, "-");
};

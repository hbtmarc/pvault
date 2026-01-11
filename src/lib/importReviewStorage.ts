import type { ImportResult } from "../ingestion/core/types";

const STORAGE_KEY = "pvault_import_review_v1";

export type StoredImportOutcome = {
  fileName: string;
  parserId: string;
  result: ImportResult;
  selectedRowIds: string[];
};

export type StoredImportReview = {
  version: 1;
  savedAt: string;
  importSessionId: string;
  selectedCardId?: string;
  outcomes: StoredImportOutcome[];
};

export const loadImportReview = (): StoredImportReview | null => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredImportReview;
    if (!parsed || parsed.version !== 1) {
      return null;
    }
    if (!parsed.importSessionId || !Array.isArray(parsed.outcomes)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const saveImportReview = (review: StoredImportReview) => {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(review));
  } catch {
    // ignore
  }
};

export const clearImportReview = () => {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

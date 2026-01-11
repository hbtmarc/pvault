import type { ParseResult } from "./types";

export const createParseResult = (): ParseResult => ({
  transactions: [],
  warnings: [],
  errors: [],
  skipped: 0,
});

export const addWarning = (result: ParseResult, message: string) => {
  result.warnings.push(message);
};

export const addError = (result: ParseResult, message: string) => {
  result.errors.push(message);
};

export const incrementSkipped = (result: ParseResult) => {
  result.skipped += 1;
};

export const hasErrors = (result: ParseResult) => result.errors.length > 0;

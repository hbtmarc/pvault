import type { ParseResult, RowResult } from "./types";

export const createParseResult = (): ParseResult => ({
  rows: [],
  errors: [],
});

export const addRow = (result: ParseResult, row: RowResult) => {
  result.rows.push(row);
};

export const addError = (result: ParseResult, message: string) => {
  result.errors.push(message);
};

export const hasErrors = (result: ParseResult) => result.errors.length > 0;

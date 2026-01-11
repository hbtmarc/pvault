export type TransactionKind = "income" | "expense" | "transfer";

export type TransactionCandidate = {
  dateISO: string;
  amountCents: number;
  kind: TransactionKind;
  description?: string;
  extraDescription?: string;
  name?: string;
  documentNumber?: string;
  rowIndex: number;
  source?: string;
  accountType?: string;
  idempotencyKey?: string;
};

export type RowStatus = "valid" | "warning" | "ignored";

export type RowResult = {
  rowId: string;
  rowIndex: number;
  status: RowStatus;
  reasonCode: string;
  reasonMessage: string;
  raw: Record<string, string>;
  txCandidate?: TransactionCandidate;
};

export type IngestionContext = {
  fileName: string;
  importSessionId: string;
  delimiter: string;
  header: string[];
  normalizedHeader: string[];
  parserId: string;
  fileHash: string;
};

export type ParseResult = {
  rows: RowResult[];
  errors: string[];
};

export type ImportCounts = {
  valid: number;
  warnings: number;
  ignored: number;
};

export type ImportResult = {
  valid: TransactionCandidate[];
  validRows: RowResult[];
  warnings: RowResult[];
  ignored: RowResult[];
  counts: ImportCounts;
  preview: TransactionCandidate[];
};

export type FileParseOutcome =
  | {
      fileName: string;
      status: "success";
      parserId: string;
      result: ImportResult;
    }
  | {
      fileName: string;
      status: "error";
      message: string;
    };

export type IngestionParser = {
  id: string;
  label: string;
  canParse: (normalizedHeader: string[]) => boolean;
  parse: (rows: string[][], context: IngestionContext) => ParseResult;
};

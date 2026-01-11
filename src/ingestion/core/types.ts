export type NormalizedTransaction = {
  dateISO: string;
  amountCents: number;
  type: "income" | "expense";
  description?: string;
  name?: string;
  documentNumber?: string;
  rowIndex: number;
  idempotencyKey?: string;
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
  transactions: NormalizedTransaction[];
  warnings: string[];
  errors: string[];
  skipped: number;
};

export type FileParseOutcome =
  | {
      fileName: string;
      status: "success";
      parserId: string;
      result: ParseResult;
      preview: NormalizedTransaction[];
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

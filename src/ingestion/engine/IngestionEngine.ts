import { decodeText } from "../core/decodeText";
import { detectDelimiter } from "../core/detectDelimiter";
import { hashStringSha256 } from "../core/hash";
import { normalizeHeader } from "../core/normalizeHeader";
import { parseCsvRows } from "../core/parseCsv";
import { createParseResult, hasErrors } from "../core/result";
import type {
  FileParseOutcome,
  IngestionContext,
  ImportResult,
  RowResult,
  ParseResult,
} from "../core/types";
import { ParserRegistry } from "./ParserRegistry";

const createImportSessionId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const withIdempotencyKeys = async (
  rows: RowResult[],
  context: IngestionContext
) => {
  const updates = rows.map(async (row) => {
    if (!row.txCandidate) {
      return row;
    }
    const tx = row.txCandidate;
    const rowKey = tx.rowIndex.toString();
    const rawKey = [
      context.fileHash,
      context.parserId,
      rowKey,
      tx.dateISO,
      tx.amountCents,
      tx.kind,
      tx.description ?? "",
      tx.name ?? "",
      tx.documentNumber ?? "",
    ].join("|");
    const digest = await hashStringSha256(rawKey);
    return {
      ...row,
      txCandidate: { ...tx, idempotencyKey: `imp_${digest}` },
    };
  });

  return Promise.all(updates);
};

const buildImportResult = (rows: RowResult[]): ImportResult => {
  const validRows = rows.filter((row) => row.status === "valid");
  const warnings = rows.filter((row) => row.status === "warning");
  const ignored = rows.filter((row) => row.status === "ignored");
  const valid = validRows
    .map((row) => row.txCandidate)
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    valid,
    warnings,
    ignored,
    counts: {
      valid: valid.length,
      warnings: warnings.length,
      ignored: ignored.length,
    },
    preview: valid.slice(0, 20),
  };
};

export class IngestionEngine {
  private readonly registry: ParserRegistry;

  constructor(registry: ParserRegistry = new ParserRegistry()) {
    this.registry = registry;
  }

  async parseFiles(
    files: File[],
    options?: { importSessionId?: string }
  ): Promise<FileParseOutcome[]> {
    const importSessionId = options?.importSessionId ?? createImportSessionId();

    return Promise.all(
      files.map(async (file) => {
        const fileName = file.name;
        try {
          const text = await decodeText(file);
          const delimiter = detectDelimiter(text);
          const rows = parseCsvRows(text, delimiter);
          const [header = [], ...dataRows] = rows;

          if (header.length === 0) {
            return {
              fileName,
              status: "error",
              message: "Cabecalho CSV nao encontrado",
            } as FileParseOutcome;
          }

          const normalizedHeader = normalizeHeader(header);
          const parser = this.registry.findByHeader(normalizedHeader);

          if (!parser) {
            return {
              fileName,
              status: "error",
              message: "Cabecalho CSV nao reconhecido",
            } as FileParseOutcome;
          }

          const fileHash = await hashStringSha256(text);
          const context: IngestionContext = {
            fileName,
            importSessionId,
            delimiter,
            header,
            normalizedHeader,
            parserId: parser.id,
            fileHash,
          };

          let result: ParseResult = createParseResult();
          try {
            result = parser.parse(dataRows, context);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Falha ao processar o CSV";
            return {
              fileName,
              status: "error",
              message,
            } as FileParseOutcome;
          }

          if (hasErrors(result)) {
            return {
              fileName,
              status: "error",
              message: result.errors[0] ?? "Falha ao processar o CSV",
            } as FileParseOutcome;
          }

          const rowsWithKeys = await withIdempotencyKeys(result.rows, context);
          const rowsWithIds = rowsWithKeys.map((row) => ({
            ...row,
            rowId: row.rowId || `${context.fileHash}:${row.rowIndex}`,
          }));

          const importResult = buildImportResult(rowsWithIds);

          return {
            fileName,
            status: "success",
            parserId: parser.id,
            result: importResult,
          } as FileParseOutcome;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Falha ao processar o CSV";
          return {
            fileName,
            status: "error",
            message,
          } as FileParseOutcome;
        }
      })
    );
  }
}

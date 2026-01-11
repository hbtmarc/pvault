import { decodeText } from "../core/decodeText";
import { detectDelimiter } from "../core/detectDelimiter";
import { hashStringSha256 } from "../core/hash";
import { normalizeHeader } from "../core/normalizeHeader";
import { parseCsvRows } from "../core/parseCsv";
import { createParseResult, hasErrors } from "../core/result";
import type {
  FileParseOutcome,
  IngestionContext,
  NormalizedTransaction,
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
  transactions: NormalizedTransaction[],
  context: IngestionContext
) => {
  const updates = transactions.map(async (tx) => {
    const rowKey = tx.rowIndex.toString();
    const rawKey = [
      context.fileHash,
      context.parserId,
      rowKey,
      tx.dateISO,
      tx.amountCents,
      tx.type,
      tx.description ?? "",
      tx.name ?? "",
      tx.documentNumber ?? "",
    ].join("|");
    const digest = await hashStringSha256(rawKey);
    return { ...tx, idempotencyKey: `imp_${digest}` };
  });

  return Promise.all(updates);
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

          const transactionsWithKeys = await withIdempotencyKeys(
            result.transactions,
            context
          );

          const preview = transactionsWithKeys.slice(0, 20);

          return {
            fileName,
            status: "success",
            parserId: parser.id,
            result: {
              ...result,
              transactions: transactionsWithKeys,
            },
            preview,
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

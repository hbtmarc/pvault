import { parseDateToISO } from "../../core/parseDate";
import { parseMoneyToCents } from "../../core/parseMoney";
import { normalizeHeader } from "../../core/normalizeHeader";
import { addError, addWarning, createParseResult, incrementSkipped } from "../../core/result";
import type { IngestionContext, IngestionParser, ParseResult } from "../../core/types";

const hasField = (header: string[], keys: string[]) =>
  keys.some((key) => header.includes(key));

const findIndex = (header: string[], keys: string[]) =>
  header.findIndex((value) => keys.includes(value));

export class BbCsvParser implements IngestionParser {
  readonly id = "csv-bb";
  readonly label = "CSV Banco do Brasil";

  canParse(normalizedHeader: string[]): boolean {
    const hasDate = hasField(normalizedHeader, ["data", "date"]);
    const hasAmount = hasField(normalizedHeader, ["valor", "amount"]);
    const hasDesc = hasField(normalizedHeader, [
      "lancamento",
      "detalhes",
      "descricao",
      "historico",
      "title",
    ]);
    return hasDate && hasAmount && hasDesc;
  }

  parse(rows: string[][], context: IngestionContext): ParseResult {
    const result = createParseResult();
    const normalizedHeader = normalizeHeader(context.header);
    const dateIndex = findIndex(normalizedHeader, ["data", "date"]);
    const amountIndex = findIndex(normalizedHeader, ["valor", "amount"]);
    const detailsIndex = findIndex(normalizedHeader, [
      "detalhes",
      "descricao",
      "historico",
      "lancamento",
      "title",
    ]);
    const documentIndex = findIndex(normalizedHeader, ["ndocumento", "documento"]);
    const typeIndex = findIndex(normalizedHeader, ["tipolancamento", "tipo"]);

    if (dateIndex < 0 || amountIndex < 0 || detailsIndex < 0) {
      addError(result, "Colunas obrigatorias ausentes.");
      return result;
    }

    rows.forEach((row, index) => {
      const rowIndex = index + 1;
      const dateRaw = row[dateIndex] ?? "";
      const amountRaw = row[amountIndex] ?? "";
      const detailsRaw = row[detailsIndex] ?? "";
      const documentRaw = documentIndex >= 0 ? row[documentIndex] ?? "" : "";
      const typeRaw = typeIndex >= 0 ? row[typeIndex] ?? "" : "";

      const dateISO = parseDateToISO(dateRaw);
      const parsedAmount = parseMoneyToCents(amountRaw);

      if (!dateISO || parsedAmount === null || parsedAmount === 0) {
        incrementSkipped(result);
        addWarning(result, `Linha ${rowIndex}: dados invalidos`);
        return;
      }

      let type: "income" | "expense" = parsedAmount < 0 ? "expense" : "income";
      const normalizedType = typeRaw.trim().toLowerCase();
      if (normalizedType.includes("entrada")) {
        type = "income";
      }
      if (normalizedType.includes("saida")) {
        type = "expense";
      }

      result.transactions.push({
        dateISO,
        amountCents: Math.abs(parsedAmount),
        type,
        description: detailsRaw.trim() || undefined,
        documentNumber: documentRaw.trim() || undefined,
        rowIndex,
      });
    });

    return result;
  }
}

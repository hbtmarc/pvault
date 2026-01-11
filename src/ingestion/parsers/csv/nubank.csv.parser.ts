import { parseDateToISO } from "../../core/parseDate";
import { parseMoneyToCents } from "../../core/parseMoney";
import { normalizeHeader } from "../../core/normalizeHeader";
import { addError, addWarning, createParseResult, incrementSkipped } from "../../core/result";
import type { IngestionContext, IngestionParser, ParseResult } from "../../core/types";

const REQUIRED_FIELDS = ["date", "title", "amount"];

const findIndex = (header: string[], key: string) => header.indexOf(key);

export class NubankCsvParser implements IngestionParser {
  readonly id = "csv-nubank";
  readonly label = "CSV Nubank";

  canParse(normalizedHeader: string[]): boolean {
    return REQUIRED_FIELDS.every((field) => normalizedHeader.includes(field));
  }

  parse(rows: string[][], context: IngestionContext): ParseResult {
    const result = createParseResult();
    const normalizedHeader = normalizeHeader(context.header);
    const dateIndex = findIndex(normalizedHeader, "date");
    const titleIndex = findIndex(normalizedHeader, "title");
    const amountIndex = findIndex(normalizedHeader, "amount");

    if (dateIndex < 0 || titleIndex < 0 || amountIndex < 0) {
      addError(result, "Colunas obrigatorias ausentes.");
      return result;
    }

    rows.forEach((row, index) => {
      const rowIndex = index + 1;
      const dateRaw = row[dateIndex] ?? "";
      const titleRaw = row[titleIndex] ?? "";
      const amountRaw = row[amountIndex] ?? "";

      const dateISO = parseDateToISO(dateRaw);
      const parsedAmount = parseMoneyToCents(amountRaw);

      if (!dateISO || parsedAmount === null || parsedAmount === 0) {
        incrementSkipped(result);
        addWarning(result, `Linha ${rowIndex}: dados invalidos`);
        return;
      }

      const amountCents = Math.abs(parsedAmount);
      const type = parsedAmount < 0 ? "expense" : "income";

      result.transactions.push({
        dateISO,
        amountCents,
        type,
        description: titleRaw.trim() || undefined,
        name: undefined,
        rowIndex,
      });
    });

    return result;
  }
}

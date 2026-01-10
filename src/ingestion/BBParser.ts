import { normalizeHeader, parseCsvRows } from "./csv";
import type { ParsedCsv } from "./types";

export class BBParser {
  readonly id = "bb";

  canParse(header: string[]): boolean {
    const normalized = normalizeHeader(header);
    const hasDate = normalized.includes("data") || normalized.includes("date");
    const hasAmount = normalized.includes("valor") || normalized.includes("amount");
    const hasDescription =
      normalized.includes("historico") ||
      normalized.includes("lancamento") ||
      normalized.includes("descricao") ||
      normalized.includes("detalhes") ||
      normalized.includes("title");
    return hasDate && hasAmount && hasDescription;
  }

  parse(text: string): ParsedCsv {
    const rows = parseCsvRows(text);
    const [header = [], ...dataRows] = rows;
    return {
      parserId: this.id,
      header,
      rows: dataRows,
    };
  }
}

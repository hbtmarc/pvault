import { normalizeHeader, parseCsvRows } from "./csv";
import type { ParsedCsv } from "./types";

export class NubankParser {
  readonly id = "nubank";

  canParse(header: string[]): boolean {
    const normalized = normalizeHeader(header);
    const hasLegacy =
      normalized.includes("data") &&
      normalized.includes("valor") &&
      normalized.includes("categoria") &&
      (normalized.includes("descricao") || normalized.includes("historico"));
    const hasEnglish =
      normalized.includes("date") &&
      normalized.includes("amount") &&
      normalized.includes("title");
    return hasLegacy || hasEnglish;
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

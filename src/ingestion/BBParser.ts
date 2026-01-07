import { normalizeHeader, parseCsvRows } from "./csv";
import type { ParsedCsv } from "./types";

export class BBParser {
  readonly id = "bb";

  canParse(header: string[]): boolean {
    const normalized = normalizeHeader(header);
    return (
      normalized.includes("data") &&
      normalized.includes("historico") &&
      normalized.includes("valor")
    );
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

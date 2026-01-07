import { normalizeHeader, parseCsvRows } from "./csv";
import type { ParsedCsv } from "./types";

export class NubankParser {
  readonly id = "nubank";

  canParse(header: string[]): boolean {
    const normalized = normalizeHeader(header);
    const hasDescricao = normalized.includes("descricao");
    return (
      normalized.includes("data") &&
      normalized.includes("valor") &&
      normalized.includes("categoria") &&
      hasDescricao
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

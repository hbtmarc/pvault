import { BBParser } from "./BBParser";
import { NubankParser } from "./NubankParser";
import { parseCsvRows } from "./csv";
import type { ParsedCsv } from "./types";

export class IngestionEngine {
  private readonly parsers = [new NubankParser(), new BBParser()];

  parseCsvByHeader(text: string): ParsedCsv {
    const rows = parseCsvRows(text);
    const [header = []] = rows;

    if (header.length === 0) {
      throw new Error("Cabeçalho CSV não encontrado");
    }

    const parser = this.parsers.find((candidate) => candidate.canParse(header));

    if (!parser) {
      throw new Error("Cabeçalho CSV não reconhecido");
    }

    return parser.parse(text);
  }
}

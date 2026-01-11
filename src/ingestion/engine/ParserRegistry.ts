import type { IngestionParser } from "../core/types";
import { BbCsvParser } from "../parsers/csv/bb.csv.parser";
import { NubankCsvParser } from "../parsers/csv/nubank.csv.parser";

export class ParserRegistry {
  private readonly parsers: IngestionParser[];

  constructor(parsers: IngestionParser[] = [new NubankCsvParser(), new BbCsvParser()]) {
    this.parsers = parsers;
  }

  getAll() {
    return this.parsers;
  }

  findByHeader(normalizedHeader: string[]) {
    return this.parsers.find((parser) => parser.canParse(normalizedHeader));
  }
}

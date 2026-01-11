import { parseDateToISO } from "../../core/parseDate";
import { parseMoneyToCents } from "../../core/parseMoney";
import { normalizeHeader } from "../../core/normalizeHeader";
import { addError, addRow, createParseResult } from "../../core/result";
import type { IngestionContext, IngestionParser, ParseResult } from "../../core/types";
import { normalizeText } from "../../../lib/normalizeText";

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
      "title",
    ]);
    const launchIndex = findIndex(normalizedHeader, ["lancamento"]);
    const documentIndex = findIndex(normalizedHeader, ["ndocumento", "documento"]);
    const typeIndex = findIndex(normalizedHeader, ["tipolancamento", "tipo"]);

    if (dateIndex < 0 || amountIndex < 0 || (detailsIndex < 0 && launchIndex < 0)) {
      addError(result, "Colunas obrigatorias ausentes.");
      return result;
    }

    rows.forEach((row, index) => {
      const rowIndex = index + 1;
      const dateRaw = row[dateIndex] ?? "";
      const amountRaw = row[amountIndex] ?? "";
      const detailsRaw = detailsIndex >= 0 ? row[detailsIndex] ?? "" : "";
      const launchRaw = launchIndex >= 0 ? row[launchIndex] ?? "" : "";
      const documentRaw = documentIndex >= 0 ? row[documentIndex] ?? "" : "";
      const typeRaw = typeIndex >= 0 ? row[typeIndex] ?? "" : "";

      const detailsTrimmed = detailsRaw.trim();
      const launchTrimmed = launchRaw.trim();

      const raw = {
        data: dateRaw.trim(),
        lancamento: launchTrimmed,
        detalhes: detailsTrimmed,
        valor: amountRaw.trim(),
      };

      const description = detailsTrimmed || launchTrimmed;
      const extraDescription =
        detailsTrimmed && launchTrimmed && detailsTrimmed !== launchTrimmed
          ? launchTrimmed
          : undefined;

      const normalizedDesc = normalizeText(description || extraDescription || "");
      if (
        normalizedDesc === "saldo" ||
        normalizedDesc === "saldo anterior" ||
        normalizedDesc.startsWith("saldo ")
      ) {
        addRow(result, {
          rowId: "",
          rowIndex,
          status: "ignored",
          reasonCode: "BALANCE_LINE",
          reasonMessage: "Linha de saldo do extrato",
          raw,
        });
        return;
      }

      if (!raw.data) {
        addRow(result, {
          rowId: "",
          rowIndex,
          status: "ignored",
          reasonCode: "MISSING_DATE",
          reasonMessage: "Data ausente",
          raw,
        });
        return;
      }

      if (!raw.valor) {
        addRow(result, {
          rowId: "",
          rowIndex,
          status: "ignored",
          reasonCode: "MISSING_AMOUNT",
          reasonMessage: "Valor ausente",
          raw,
        });
        return;
      }

      const dateISO = parseDateToISO(raw.data);
      if (!dateISO) {
        addRow(result, {
          rowId: "",
          rowIndex,
          status: "ignored",
          reasonCode: "INVALID_DATE",
          reasonMessage: "Data invalida",
          raw,
        });
        return;
      }

      const parsedAmount = parseMoneyToCents(raw.valor);
      if (parsedAmount === null) {
        addRow(result, {
          rowId: "",
          rowIndex,
          status: "ignored",
          reasonCode: "INVALID_AMOUNT",
          reasonMessage: "Valor invalido",
          raw,
        });
        return;
      }

      const amountCents = Math.abs(parsedAmount);
      if (amountCents === 0) {
        addRow(result, {
          rowId: "",
          rowIndex,
          status: "ignored",
          reasonCode: "ZERO_AMOUNT",
          reasonMessage: "Valor zerado",
          raw,
        });
        return;
      }

      let kind: "income" | "expense" = parsedAmount < 0 ? "expense" : "income";
      const normalizedType = typeRaw.trim().toLowerCase();
      if (normalizedType.includes("entrada")) {
        kind = "income";
      }
      if (normalizedType.includes("saida")) {
        kind = "expense";
      }

      const hasDescription = Boolean(description);
      const status = hasDescription ? "valid" : "warning";
      const reasonCode = hasDescription ? "OK" : "MISSING_DESCRIPTION";
      const reasonMessage = hasDescription ? "Linha valida" : "Descricao ausente";

      addRow(result, {
        rowId: "",
        rowIndex,
        status,
        reasonCode,
        reasonMessage,
        raw,
        txCandidate: {
          dateISO,
          amountCents,
          kind,
          description: description || undefined,
          extraDescription,
          documentNumber: documentRaw.trim() || undefined,
          rowIndex,
          source: "bb",
          accountType: "checking",
        },
      });
    });

    return result;
  }
}

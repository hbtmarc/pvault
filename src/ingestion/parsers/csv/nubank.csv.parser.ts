import { parseDateToISO } from "../../core/parseDate";
import { parseMoneyToCents } from "../../core/parseMoney";
import { normalizeHeader } from "../../core/normalizeHeader";
import { addError, addRow, createParseResult } from "../../core/result";
import type { IngestionContext, IngestionParser, ParseResult } from "../../core/types";
import { normalizeText } from "../../../lib/normalizeText";

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

      const raw = {
        date: dateRaw.trim(),
        title: titleRaw.trim(),
        amount: amountRaw.trim(),
      };

      if (!raw.date) {
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

      if (!raw.amount) {
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

      const dateISO = parseDateToISO(raw.date);
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

      const parsedAmount = parseMoneyToCents(raw.amount);
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

      const title = raw.title;
      const normalizedTitle = normalizeText(title);

      if (normalizedTitle.includes("pagamento recebido")) {
        addRow(result, {
          rowId: "",
          rowIndex,
          status: "ignored",
          reasonCode: "CARD_PAYMENT",
          reasonMessage: "Pagamento de fatura (neutro)",
          raw,
          txCandidate: {
            dateISO,
            amountCents,
            kind: "transfer",
            description: title || undefined,
            rowIndex,
            source: "nubank",
            accountType: "credit_card",
          },
        });
        return;
      }

      const isRefund =
        normalizedTitle.includes("estorno") || normalizedTitle.includes("reembolso");
      const kind = isRefund ? "income" : "expense";
      const hasDescription = Boolean(title);
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
          description: title || undefined,
          rowIndex,
          source: "nubank",
          accountType: "credit_card",
        },
      });
    });

    return result;
  }
}

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "../components/AppShell";
import Button from "../components/Button";
import Card from "../components/Card";
import { importUploadedFiles } from "../ingestion/importUploadedFiles";
import type {
  FileParseOutcome,
  ImportResult,
  RowResult,
  TransactionCandidate,
} from "../ingestion/core/types";
import { upsertTransactions } from "../ingestion/firestoreUpsert";
import { getInvoiceMonthKey, getMonthKeyFromDateISO, shiftMonthKey } from "../lib/date";
import type {
  Card as CardType,
  Category,
  MerchantCategoryRule,
  PaymentMethod,
  Transaction,
  TransactionKind,
} from "../lib/firestore";
import {
  listCards,
  listCategories,
  listMerchantCategoryRules,
  seedDefaultCategories,
} from "../lib/firestore";
import { formatCentsToInput, formatCurrency, parseBRLToCents } from "../lib/money";
import { db } from "../lib/firebase";
import { useAdmin } from "../providers/AdminProvider";
import { categorizeTransaction, DEFAULT_CATEGORY_SEED } from "../lib/categorizeTransaction";
import { normalizeText } from "../lib/normalizeText";
import { parseInstallments } from "../lib/parseInstallments";
import { hashStringSha256 } from "../lib/hash";
import { buildMerchantKey } from "../lib/merchantRules";
import { parseDateToISO } from "../ingestion/core/parseDate";
import {
  clearImportReview,
  loadImportReview,
  saveImportReview,
  type StoredImportReview,
} from "../lib/importReviewStorage";

const statusStyles = {
  success: "text-emerald-600",
  error: "text-rose-600",
};

const statusLabels = {
  success: "Sucesso",
  error: "Erro",
};

const createImportSessionId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

type ImportPreviewTransaction = {
  id: string;
  dateISO: string;
  description: string;
  amountCents: number;
  kind: TransactionKind;
  categoryName: string;
  invoiceMonthKey?: string;
  installmentLabel?: string;
};

type ReviewRow = RowResult & {
  userIncluded?: boolean;
};

type ReviewTab = "valid" | "warning" | "ignored";

type PreparedRow = {
  rowId: string;
  status: "valid" | "warning" | "ignored";
  preview: ImportPreviewTransaction;
  transactions: Transaction[];
  projectedCount: number;
};

type ImportOutcomeSuccess = {
  status: "success";
  fileName: string;
  parserId: string;
  result: ImportResult;
  preparedValid: PreparedRow[];
  preparedOptional: PreparedRow[];
  projectedCount: number;
};

type ImportOutcomeError = {
  status: "error";
  fileName: string;
  message: string;
};

type ImportOutcome = ImportOutcomeSuccess | ImportOutcomeError;

const DEFAULT_CATEGORY_BY_ID = new Map(
  DEFAULT_CATEGORY_SEED.map((category) => [category.id, category])
);

const isNubankCardFile = (fileName: string) =>
  /nubank_\d{4}-\d{2}-\d{2}\.csv$/i.test(fileName);

const formatAmountLabel = (kind: TransactionKind, amountCents: number) => {
  if (kind === "income") {
    return `+ ${formatCurrency(amountCents)}`;
  }
  if (kind === "expense") {
    return `- ${formatCurrency(amountCents)}`;
  }
  return formatCurrency(amountCents);
};

const REVIEW_PAGE_SIZE = 50;

const ImportTransactionsPage = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [outcomes, setOutcomes] = useState<ImportOutcome[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [formError, setFormError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [importSessionId, setImportSessionId] = useState<string | null>(null);
  const [cards, setCards] = useState<CardType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [archivedCategories, setArchivedCategories] = useState<Category[]>([]);
  const [merchantRules, setMerchantRules] = useState<MerchantCategoryRule[]>([]);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [seedingCategories, setSeedingCategories] = useState(false);
  const [selectedRowIdsByFile, setSelectedRowIdsByFile] = useState<
    Record<string, Set<string>>
  >({});
  const [visibleReviewRows, setVisibleReviewRows] = useState<Record<string, number>>(
    {}
  );
  const [reviewTabByFile, setReviewTabByFile] = useState<
    Record<string, ReviewTab>
  >({});
  const [restoreNotice, setRestoreNotice] = useState("");
  const [pendingRestore, setPendingRestore] = useState<StoredImportReview | null>(
    null
  );
  const { effectiveUid, isImpersonating } = useAdmin();
  const canWrite = Boolean(effectiveUid) && !isImpersonating;
  const rebuildTimers = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!effectiveUid) {
      return undefined;
    }

    const unsubscribe = listCards(
      effectiveUid,
      false,
      (items) => setCards(items),
      (err) => {
        if (import.meta.env.DEV) {
          console.error("[import] falha ao carregar cartoes", err);
        }
      }
    );

    return () => unsubscribe();
  }, [effectiveUid]);

  useEffect(() => {
    if (!effectiveUid) {
      return undefined;
    }

    const unsubscribeActive = listCategories(
      effectiveUid,
      false,
      (items) => setCategories(items),
      (err) => {
        if (import.meta.env.DEV) {
          console.error("[import] falha ao carregar categorias", err);
        }
      }
    );

    const unsubscribeArchived = listCategories(
      effectiveUid,
      true,
      (items) => setArchivedCategories(items),
      (err) => {
        if (import.meta.env.DEV) {
          console.error("[import] falha ao carregar categorias arquivadas", err);
        }
      }
    );

    return () => {
      unsubscribeActive();
      unsubscribeArchived();
    };
  }, [effectiveUid]);

  useEffect(() => {
    if (!effectiveUid) {
      return undefined;
    }

    const unsubscribe = listMerchantCategoryRules(
      effectiveUid,
      (items) => setMerchantRules(items),
      (err) => {
        if (import.meta.env.DEV) {
          console.error("[import] falha ao carregar regras de merchant", err);
        }
      }
    );

    return () => unsubscribe();
  }, [effectiveUid]);

  useEffect(() => {
    if (!effectiveUid || !canWrite) {
      return;
    }

    if (categories.length > 0 || archivedCategories.length > 0) {
      return;
    }

    if (seedingCategories) {
      return;
    }

    setSeedingCategories(true);
    seedDefaultCategories(effectiveUid)
      .catch((err) => {
        if (import.meta.env.DEV) {
          console.error("[import] falha ao semear categorias", err);
        }
      })
      .finally(() => setSeedingCategories(false));
  }, [effectiveUid, canWrite, categories.length, archivedCategories.length, seedingCategories]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = loadImportReview();
      if (stored) {
        setPendingRestore(stored);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!pendingRestore || !effectiveUid) {
      return;
    }

    const hasCardFiles = pendingRestore.outcomes.some((outcome) =>
      isNubankCardFile(outcome.fileName)
    );
    if (hasCardFiles && cards.length === 0) {
      return;
    }

    const restore = async () => {
      const sessionId =
        pendingRestore.importSessionId || createImportSessionId();
      setImportSessionId(sessionId);
      setSelectedCardId(pendingRestore.selectedCardId ?? "");

      const restoredOutcomes = await Promise.all(
        pendingRestore.outcomes.map((outcome) =>
          buildImportOutcome(
            {
              status: "success",
              fileName: outcome.fileName,
              parserId: outcome.parserId,
              result: outcome.result,
            },
            sessionId,
            effectiveUid
          )
        )
      );

      const selectedMap: Record<string, Set<string>> = {};
      const reviewTabs: Record<string, ReviewTab> = {};
      pendingRestore.outcomes.forEach((outcome) => {
        selectedMap[outcome.fileName] = new Set(outcome.selectedRowIds);
        reviewTabs[outcome.fileName] = "valid";
      });

      setOutcomes(restoredOutcomes);
      setSelectedRowIdsByFile(selectedMap);
      setReviewTabByFile(reviewTabs);
      setVisibleReviewRows({});
      setRestoreNotice(
        "Revisao restaurada do ultimo resultado. Se precisar reprocessar, selecione o arquivo novamente."
      );
      setPendingRestore(null);
    };

    void restore();
  }, [pendingRestore, effectiveUid, cards.length, cards]);

  useEffect(() => {
    return () => {
      Object.values(rebuildTimers.current).forEach((timer) =>
        window.clearTimeout(timer)
      );
    };
  }, []);

  const successfulOutcomes = useMemo(
    () => outcomes.filter((outcome) => outcome.status === "success"),
    [outcomes]
  ) as ImportOutcomeSuccess[];

  useEffect(() => {
    if (!importSessionId || successfulOutcomes.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      const stored: StoredImportReview = {
        version: 1,
        savedAt: new Date().toISOString(),
        importSessionId,
        selectedCardId: selectedCardId || undefined,
        outcomes: successfulOutcomes.map((outcome) => ({
          fileName: outcome.fileName,
          parserId: outcome.parserId,
          result: outcome.result,
          selectedRowIds: Array.from(getSelectedRowIds(outcome.fileName)),
        })),
      };
      saveImportReview(stored);
    }, 200);

    return () => window.clearTimeout(timer);
  }, [importSessionId, successfulOutcomes, selectedRowIdsByFile, selectedCardId]);

  const allCategories = useMemo(
    () => [...categories, ...archivedCategories],
    [categories, archivedCategories]
  );

  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>();
    allCategories.forEach((category) => {
      map.set(category.id, category);
    });
    return map;
  }, [allCategories]);

  const categoriesByNameAndType = useMemo(() => {
    const map = new Map<string, Category>();
    allCategories.forEach((category) => {
      const key = `${normalizeText(category.name)}:${category.type}`;
      map.set(key, category);
    });
    return map;
  }, [allCategories]);

  const cardsById = useMemo(() => {
    const map = new Map<string, CardType>();
    cards.forEach((card) => {
      map.set(card.id, card);
    });
    return map;
  }, [cards]);

  const merchantRulesByKey = useMemo(() => {
    const map = new Map<string, string>();
    merchantRules.forEach((rule) => {
      if (rule.merchantKey && rule.categoryId) {
        map.set(rule.merchantKey, rule.categoryId);
      }
    });
    return map;
  }, [merchantRules]);

  const needsCardSelection = useMemo(() => {
    const cardFiles = selectedFiles.filter((file) => isNubankCardFile(file.name));
    if (cardFiles.length === 0) {
      return false;
    }
    if (cards.length <= 1) {
      return false;
    }
    return cardFiles.some((file) => {
      const normalizedFile = normalizeText(file.name);
      const matches = cards.filter((card) =>
        normalizedFile.includes(normalizeText(card.name))
      );
      return matches.length !== 1;
    });
  }, [selectedFiles, cards]);

  const totalTransactions = useMemo(
    () =>
      successfulOutcomes.reduce((sum, outcome) => {
        const selectedIds = getSelectedRowIds(outcome.fileName);
        const validCount = outcome.preparedValid.reduce(
          (acc, row) => acc + row.transactions.length,
          0
        );
        const optionalRows = [
          ...outcome.result.warnings,
          ...outcome.result.ignored,
        ] as ReviewRow[];
        const optionalById = new Map(optionalRows.map((row) => [row.rowId, row]));
        const selectedCount = outcome.preparedOptional
          .filter((row) => {
            if (!selectedIds.has(row.rowId)) {
              return false;
            }
            const sourceRow = optionalById.get(row.rowId);
            return sourceRow ? isRowSelectable(sourceRow) : false;
          })
          .reduce((acc, row) => acc + row.transactions.length, 0);
        return sum + validCount + selectedCount;
      }, 0),
    [successfulOutcomes, selectedRowIdsByFile]
  );

  const resolveCardIdForFile = (fileName: string) => {
    if (cards.length === 0) {
      return undefined;
    }
    if (cards.length === 1) {
      return cards[0]?.id;
    }

    const normalizedFile = normalizeText(fileName);
    const matches = cards.filter((card) =>
      normalizedFile.includes(normalizeText(card.name))
    );

    if (matches.length === 1) {
      return matches[0]?.id;
    }

    if (selectedCardId && cardsById.has(selectedCardId)) {
      return selectedCardId;
    }

    return undefined;
  };

  const resolveCategoryId = (categoryKey: string | undefined, kind: TransactionKind) => {
    if (kind === "transfer") {
      return undefined;
    }

    if (!categoryKey) {
      return undefined;
    }

    const direct = categoriesById.get(categoryKey);
    if (direct && direct.type === kind) {
      return direct.id;
    }

    const defaultDef = DEFAULT_CATEGORY_BY_ID.get(categoryKey);
    const normalizedName = normalizeText(defaultDef?.name ?? categoryKey);
    const byName = categoriesByNameAndType.get(`${normalizedName}:${kind}`);
    return byName?.id;
  };

  const resolveCategoryName = (categoryId?: string) => {
    if (!categoryId) {
      return "Sem categoria";
    }
    return categoriesById.get(categoryId)?.name ?? "Categoria removida";
  };

  function getSelectedRowIds(fileName: string) {
    return selectedRowIdsByFile[fileName] ?? new Set<string>();
  }

  const toggleRowSelection = (fileName: string, rowId: string, selected: boolean) => {
    setSelectedRowIdsByFile((prev) => {
      const current = prev[fileName] ?? new Set<string>();
      const next = new Set(current);
      if (selected) {
        next.add(rowId);
      } else {
        next.delete(rowId);
      }
      return { ...prev, [fileName]: next };
    });
  };

  const getVisibleCount = (fileName: string, bucket: ReviewTab) => {
    const key = `${fileName}:${bucket}`;
    return visibleReviewRows[key] ?? REVIEW_PAGE_SIZE;
  };

  const showMoreRows = (fileName: string, bucket: ReviewTab) => {
    const key = `${fileName}:${bucket}`;
    setVisibleReviewRows((prev) => ({
      ...prev,
      [key]: (prev[key] ?? REVIEW_PAGE_SIZE) + REVIEW_PAGE_SIZE,
    }));
  };

  const getRawValue = (row: RowResult, keys: string[]) => {
    const raw = row.raw ?? {};
    for (const key of keys) {
      const value = raw[key];
      if (value) {
        return value;
      }
    }
    return "";
  };

  const setRawValue = (row: RowResult, keys: string[], value: string) => {
    const raw = { ...(row.raw ?? {}) };
    const existingKey = keys.find((key) => raw[key] !== undefined) ?? keys[0];
    raw[existingKey] = value;
    return raw;
  };

  const resolveRowDescription = (row: RowResult) =>
    row.txCandidate?.description ||
    row.txCandidate?.name ||
    getRawValue(row, ["description", "title", "lancamento", "detalhes"]) ||
    "";

  const resolveRowDateISO = (row: RowResult) => {
    const rawValue = getRawValue(row, ["date", "data"]);
    return row.txCandidate?.dateISO || parseDateToISO(rawValue) || "";
  };

  const resolveRowAmountCents = (row: RowResult) => {
    if (row.txCandidate?.amountCents !== undefined) {
      return row.txCandidate.amountCents;
    }
    const rawValue = getRawValue(row, ["amount", "valor"]);
    const parsed = parseBRLToCents(rawValue);
    return parsed === null ? undefined : Math.abs(parsed);
  };

  const getRowDisplay = (row: RowResult) => {
    const date = resolveRowDateISO(row) || row.rowIndex.toString();
    const description = resolveRowDescription(row) || "-";
    const amount =
      row.txCandidate && row.txCandidate.amountCents !== undefined
        ? formatAmountLabel(row.txCandidate.kind, row.txCandidate.amountCents)
        : getRawValue(row, ["amount", "valor"]) || "-";
    return { date, description, amount };
  };

  const isCandidateComplete = (candidate?: TransactionCandidate) =>
    Boolean(
      candidate &&
        candidate.dateISO &&
        candidate.description &&
        candidate.amountCents > 0
    );

  const inferCandidateKind = (
    parserId: string,
    description: string,
    row: RowResult
  ): TransactionKind => {
    const normalized = normalizeText(description);
    if (normalized.includes("pagamento recebido")) {
      return "transfer";
    }
    if (normalized.includes("estorno") || normalized.includes("reembolso")) {
      return "income";
    }
    const rawType = normalizeText(getRawValue(row, ["tipo"]));
    if (rawType.includes("entrada")) {
      return "income";
    }
    if (rawType.includes("saida")) {
      return "expense";
    }
    return parserId === "csv-bb" ? "expense" : "expense";
  };

  const buildCandidateFromRow = (
    row: ReviewRow,
    parserId: string
  ): TransactionCandidate | undefined => {
    const description = resolveRowDescription(row).trim();
    const dateISO = resolveRowDateISO(row);
    const amountCents = resolveRowAmountCents(row);

    if (!description || !dateISO || amountCents === undefined || amountCents <= 0) {
      return undefined;
    }

    const kind =
      row.txCandidate?.kind ?? inferCandidateKind(parserId, description, row);
    const source =
      row.txCandidate?.source ?? (parserId === "csv-bb" ? "bb" : "nubank");
    const accountType =
      row.txCandidate?.accountType ??
      (parserId === "csv-bb" ? "checking" : "credit_card");

    return {
      dateISO,
      amountCents: Math.abs(amountCents),
      kind,
      description,
      extraDescription: row.txCandidate?.extraDescription,
      name: row.txCandidate?.name,
      documentNumber: row.txCandidate?.documentNumber,
      rowIndex: row.rowIndex,
      source,
      accountType,
      idempotencyKey: row.txCandidate?.idempotencyKey ?? `imp_${row.rowId}`,
    };
  };

  const isRowSelectable = (row: ReviewRow) => {
    if (row.reasonCode === "BALANCE_LINE" || row.reasonCode === "ZERO_AMOUNT") {
      return false;
    }
    if (row.reasonCode === "CARD_PAYMENT" && !row.userIncluded) {
      return false;
    }
    return isCandidateComplete(row.txCandidate);
  };

  const buildInstallmentGroupId = async (
    uid: string,
    cardId: string,
    baseDescription: string,
    amountCents: number,
    installmentTotal: number
  ) => {
    const rawKey = [
      uid,
      cardId,
      normalizeText(baseDescription),
      Math.abs(amountCents),
      installmentTotal,
    ].join("|");
    const digest = await hashStringSha256(rawKey);
    return `inst_${digest}`;
  };

  const buildInstallmentTxId = async (
    uid: string,
    source: string,
    cardId: string,
    groupId: string,
    installmentIndex: number,
    invoiceMonthKey: string
  ) => {
    const rawKey = [
      uid,
      source,
      cardId,
      groupId,
      installmentIndex,
      invoiceMonthKey,
    ].join("|");
    const digest = await hashStringSha256(rawKey);
    return `tx_${digest}`;
  };

  const scheduleOutcomeRebuild = (outcome: ImportOutcomeSuccess) => {
    if (!effectiveUid) {
      return;
    }

    const sessionId = importSessionId ?? createImportSessionId();
    if (!importSessionId) {
      setImportSessionId(sessionId);
    }

    const timerKey = outcome.fileName;
    if (rebuildTimers.current[timerKey]) {
      window.clearTimeout(rebuildTimers.current[timerKey]);
    }

    rebuildTimers.current[timerKey] = window.setTimeout(async () => {
      const rebuilt = await buildImportOutcome(
        {
          status: "success",
          fileName: outcome.fileName,
          parserId: outcome.parserId,
          result: outcome.result,
        },
        sessionId,
        effectiveUid
      );

      if (rebuilt.status === "success") {
        setOutcomes((prev) =>
          prev.map((item) =>
            item.status === "success" && item.fileName === outcome.fileName
              ? rebuilt
              : item
          )
        );
      }
    }, 250);
  };

  const updateOutcomeRow = (
    fileName: string,
    rowId: string,
    updater: (row: ReviewRow, parserId: string) => ReviewRow
  ) => {
    let updatedRow: ReviewRow | null = null;

    setOutcomes((prev) =>
      prev.map((outcome) => {
        if (outcome.status !== "success" || outcome.fileName !== fileName) {
          return outcome;
        }

        const updateRows = (rows: RowResult[]) =>
          rows.map((row) => {
            if (row.rowId !== rowId) {
              return row;
            }
            const nextRow = updater(row as ReviewRow, outcome.parserId);
            updatedRow = nextRow;
            return nextRow;
          });

        const nextResult: ImportResult = {
          ...outcome.result,
          validRows: updateRows(outcome.result.validRows ?? []),
          warnings: updateRows(outcome.result.warnings),
          ignored: updateRows(outcome.result.ignored),
        };

        const nextOutcome: ImportOutcomeSuccess = {
          ...outcome,
          result: nextResult,
        };

        scheduleOutcomeRebuild(nextOutcome);
        return nextOutcome;
      })
    );

    setSelectedRowIdsByFile((prev) => {
      const current = prev[fileName];
      if (!current || !current.has(rowId)) {
        return prev;
      }
      if (!updatedRow || isRowSelectable(updatedRow)) {
        return prev;
      }
      const next = new Set(current);
      next.delete(rowId);
      return { ...prev, [fileName]: next };
    });
  };

  const updateRowDescription = (fileName: string, row: ReviewRow, value: string) => {
    updateOutcomeRow(fileName, row.rowId, (current, parserId) => {
      const nextRaw = setRawValue(current, ["description", "title", "lancamento", "detalhes"], value);
      const nextRow = { ...current, raw: nextRaw };
      return { ...nextRow, txCandidate: buildCandidateFromRow(nextRow, parserId) };
    });
  };

  const updateRowDate = (fileName: string, row: ReviewRow, value: string) => {
    updateOutcomeRow(fileName, row.rowId, (current, parserId) => {
      const nextRaw = setRawValue(current, ["date", "data"], value);
      const nextRow = { ...current, raw: nextRaw };
      return { ...nextRow, txCandidate: buildCandidateFromRow(nextRow, parserId) };
    });
  };

  const updateRowAmount = (fileName: string, row: ReviewRow, value: string) => {
    updateOutcomeRow(fileName, row.rowId, (current, parserId) => {
      const nextRaw = setRawValue(current, ["amount", "valor"], value);
      const nextRow = { ...current, raw: nextRaw };
      return { ...nextRow, txCandidate: buildCandidateFromRow(nextRow, parserId) };
    });
  };

  const updateRowCardPayment = (
    fileName: string,
    row: ReviewRow,
    include: boolean
  ) => {
    updateOutcomeRow(fileName, row.rowId, (current) => ({
      ...current,
      userIncluded: include,
    }));
  };

  const prepareCandidateRow = async (
    candidate: TransactionCandidate,
    rowId: string,
    status: "valid" | "warning" | "ignored",
    meta: {
      fileName: string;
      parserId: string;
      paymentMethod: PaymentMethod;
      cardId?: string;
      card?: CardType;
      sessionId: string;
      uid: string;
    }
  ): Promise<PreparedRow> => {
    const rawDescription = candidate.description?.trim() || candidate.name?.trim() || "";
    const extraDescription = candidate.extraDescription?.trim() || "";
    const descriptionSeed = rawDescription || extraDescription;
    const baseDescription = descriptionSeed || "Sem descricao";
    const kind = candidate.kind;

    const merchantKey = descriptionSeed ? buildMerchantKey(descriptionSeed) : "";
    const merchantCategoryId = merchantKey
      ? merchantRulesByKey.get(merchantKey)
      : undefined;
    const suggestion = categorizeTransaction(
      rawDescription,
      extraDescription,
      candidate.amountCents,
      kind
    );
    const suggestedCategoryId =
      merchantCategoryId ?? resolveCategoryId(suggestion.categoryKey, kind);
    const categoryName = resolveCategoryName(suggestedCategoryId);

    const installmentInfo =
      meta.paymentMethod === "card" && kind === "expense"
        ? parseInstallments(rawDescription)
        : null;
    const installmentTotal =
      installmentInfo && installmentInfo.installmentTotal > 1
        ? installmentInfo.installmentTotal
        : undefined;
    const installmentIndex = installmentInfo?.installmentIndex;
    const description = installmentInfo?.baseDescription?.trim() || baseDescription;

    const invoiceMonthKey =
      meta.paymentMethod === "card" && meta.card
        ? getInvoiceMonthKey(candidate.dateISO, meta.card.closingDay)
        : undefined;
    const monthKey = getMonthKeyFromDateISO(candidate.dateISO);

    const canProject =
      meta.paymentMethod === "card" &&
      meta.cardId &&
      invoiceMonthKey &&
      installmentTotal &&
      installmentIndex &&
      kind === "expense";

    let installmentGroupId: string | undefined = undefined;
    let resolvedId = candidate.idempotencyKey ?? `imp-${meta.sessionId}-${candidate.rowIndex}`;

    if (canProject) {
      installmentGroupId = await buildInstallmentGroupId(
        meta.uid,
        meta.cardId!,
        description,
        candidate.amountCents,
        installmentTotal
      );
      resolvedId = await buildInstallmentTxId(
        meta.uid,
        meta.parserId,
        meta.cardId!,
        installmentGroupId,
        installmentIndex!,
        invoiceMonthKey!
      );
    }

    const baseTransaction: Transaction = {
      id: resolvedId,
      type: kind,
      kind,
      paymentMethod: meta.paymentMethod,
      amountCents: candidate.amountCents,
      date: candidate.dateISO,
      monthKey,
      invoiceMonthKey,
      description,
      name: candidate.name,
      documentNumber: candidate.documentNumber,
      categoryId: suggestedCategoryId,
      cardId: meta.cardId,
      statementMonthKey: meta.paymentMethod === "card" ? invoiceMonthKey : undefined,
      importSessionId: meta.sessionId,
      importFileName: meta.fileName,
      idempotencyKey: candidate.idempotencyKey ?? resolvedId,
      installmentGroupId,
      installmentIndex: canProject ? installmentIndex : undefined,
      installmentCount: canProject ? installmentTotal : undefined,
      installmentTotal: canProject ? installmentTotal : undefined,
      installmentsTotal: canProject ? installmentTotal : undefined,
      isProjected: canProject ? false : undefined,
      settledAt: meta.paymentMethod === "card" ? null : undefined,
    };

    const transactions: Transaction[] = [baseTransaction];
    let projectedCount = 0;

    if (
      canProject &&
      installmentTotal &&
      installmentIndex < installmentTotal &&
      installmentGroupId
    ) {
      for (let index = installmentIndex + 1; index <= installmentTotal; index += 1) {
        const projectedInvoiceMonthKey = shiftMonthKey(
          invoiceMonthKey!,
          index - installmentIndex
        );
        const projectedDate = `${projectedInvoiceMonthKey}-01`;
        const projectedId = await buildInstallmentTxId(
          meta.uid,
          meta.parserId,
          meta.cardId!,
          installmentGroupId,
          index,
          projectedInvoiceMonthKey
        );

        transactions.push({
          id: projectedId,
          type: "expense",
          kind: "expense",
          paymentMethod: "card",
          amountCents: candidate.amountCents,
          date: projectedDate,
          monthKey: projectedInvoiceMonthKey,
          invoiceMonthKey: projectedInvoiceMonthKey,
          description: `${description} Parcela ${index}/${installmentTotal}`,
          categoryId: suggestedCategoryId,
          cardId: meta.cardId,
          statementMonthKey: projectedInvoiceMonthKey,
          importSessionId: meta.sessionId,
          importFileName: meta.fileName,
          idempotencyKey: projectedId,
          installmentGroupId,
          installmentIndex: index,
          installmentCount: installmentTotal,
          installmentTotal: installmentTotal,
          installmentsTotal: installmentTotal,
          isProjected: true,
          settledAt: null,
        });

        projectedCount += 1;
      }
    }

    return {
      rowId,
      status,
      preview: {
        id: baseTransaction.id,
        dateISO: candidate.dateISO,
        description,
        amountCents: candidate.amountCents,
        kind,
        categoryName,
        invoiceMonthKey,
        installmentLabel: canProject ? `${installmentIndex}/${installmentTotal}` : undefined,
      },
      transactions,
      projectedCount,
    };
  };

  const buildImportOutcome = async (
    outcome: FileParseOutcome,
    sessionId: string,
    uid: string
  ): Promise<ImportOutcome> => {
    if (outcome.status !== "success") {
      return {
        status: "error",
        fileName: outcome.fileName,
        message: outcome.message,
      };
    }

    const normalizedResult: ImportResult = outcome.result.validRows
      ? outcome.result
      : {
          ...outcome.result,
          validRows: outcome.result.valid.map((candidate, index) => ({
            rowId: candidate.idempotencyKey ?? `${outcome.fileName}-valid-${index}`,
            rowIndex: candidate.rowIndex ?? index + 1,
            status: "valid",
            reasonCode: "OK",
            reasonMessage: "Linha valida",
            raw: {
              date: candidate.dateISO,
              title: candidate.description ?? candidate.name ?? "",
              amount: formatCentsToInput(candidate.amountCents),
            },
            txCandidate: candidate,
          })),
        };

    const isCardFile =
      outcome.parserId === "csv-nubank" && isNubankCardFile(outcome.fileName);
    const paymentMethod: PaymentMethod = isCardFile ? "card" : "cash";
    const cardId = isCardFile ? resolveCardIdForFile(outcome.fileName) : undefined;
    const card = cardId ? cardsById.get(cardId) : undefined;

    if (isCardFile && !cardId) {
      return {
        status: "error",
        fileName: outcome.fileName,
        message: "Selecione um cartao para importar os arquivos Nubank.",
      };
    }

    if (isCardFile && !card) {
      return {
        status: "error",
        fileName: outcome.fileName,
        message: "Cartao selecionado nao encontrado.",
      };
    }

    const baseMeta = {
      fileName: outcome.fileName,
      parserId: outcome.parserId,
      paymentMethod,
      cardId,
      card,
      sessionId,
      uid,
    };

    const preparedValid = await Promise.all(
      normalizedResult.valid.map((candidate, index) =>
        prepareCandidateRow(
          candidate,
          candidate.idempotencyKey ?? `${outcome.fileName}-valid-${index}`,
          "valid",
          baseMeta
        )
      )
    );

    const optionalRows = [
      ...normalizedResult.warnings,
      ...normalizedResult.ignored,
    ].filter(
      (row): row is RowResult & { txCandidate: TransactionCandidate } =>
        Boolean(row.txCandidate)
    );

    const preparedOptional = await Promise.all(
      optionalRows.map((row) =>
        prepareCandidateRow(row.txCandidate, row.rowId, row.status, baseMeta)
      )
    );

    const projectedCount = preparedValid.reduce(
      (sum, row) => sum + row.projectedCount,
      0
    );

    return {
      status: "success",
      fileName: outcome.fileName,
      parserId: outcome.parserId,
      result: normalizedResult,
      preparedValid,
      preparedOptional,
      projectedCount,
    };
  };

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0) {
      setFormError("Selecione um arquivo para importar.");
      return;
    }

    if (!effectiveUid) {
      setFormError("Nao foi possivel identificar o usuario.");
      return;
    }

    const hasCardFiles = selectedFiles.some((file) => isNubankCardFile(file.name));
    if (hasCardFiles && cards.length === 0) {
      setFormError("Cadastre um cartao antes de importar arquivos Nubank.");
      return;
    }

    if (needsCardSelection && !selectedCardId) {
      setFormError("Selecione o cartao para os arquivos Nubank.");
      return;
    }

    if (needsCardSelection && selectedCardId && !cardsById.has(selectedCardId)) {
      setFormError("Cartao selecionado nao encontrado.");
      return;
    }

    setAnalyzing(true);
    setFormError("");
    setImportMessage("");
    clearImportReview();
    setRestoreNotice("");

    try {
      const sessionId = createImportSessionId();
      setImportSessionId(sessionId);
      const results = await importUploadedFiles(selectedFiles, {
        importSessionId: sessionId,
      });
      const enriched = await Promise.all(
        results.map((outcome) => buildImportOutcome(outcome, sessionId, effectiveUid))
      );
      setOutcomes(enriched);
      setSelectedRowIdsByFile({});
      setVisibleReviewRows({});
      setReviewTabByFile(
        enriched.reduce<Record<string, ReviewTab>>((acc, outcome) => {
          acc[outcome.fileName] = "valid";
          return acc;
        }, {})
      );

      if (import.meta.env.DEV) {
        console.log(
          "[import] outcomes",
          enriched.map((outcome) => ({
            fileName: outcome.fileName,
            status: outcome.status,
            count: outcome.status === "success" ? outcome.result.counts.valid : 0,
            projected: outcome.status === "success" ? outcome.projectedCount : 0,
          }))
        );
      } else {
        console.log("[import] outcomes", {
          totalFiles: enriched.length,
          success: enriched.filter((outcome) => outcome.status === "success").length,
          failed: enriched.filter((outcome) => outcome.status === "error").length,
        });
      }
    } catch (error) {
      setFormError("Nao foi possivel analisar o arquivo.");
      if (import.meta.env.DEV) {
        console.error("[import] falha ao analisar", error);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (!canWrite) {
      setFormError("Importacao bloqueada durante a impersonacao.");
      return;
    }

    if (!effectiveUid) {
      setFormError("Nao foi possivel identificar o usuario.");
      return;
    }

    if (successfulOutcomes.length === 0 || !importSessionId) {
      setFormError("Nenhum arquivo valido para importar.");
      return;
    }

    setImporting(true);
    setFormError("");
    setImportMessage("");

    try {
      const allTransactions = successfulOutcomes.flatMap((outcome) => {
        const selectedIds = getSelectedRowIds(outcome.fileName);
        const validTransactions = outcome.preparedValid.flatMap(
          (row) => row.transactions
        );
        const optionalRows = [
          ...outcome.result.warnings,
          ...outcome.result.ignored,
        ] as ReviewRow[];
        const optionalById = new Map(optionalRows.map((row) => [row.rowId, row]));
        const selectedTransactions = outcome.preparedOptional
          .filter((row) => {
            if (!selectedIds.has(row.rowId)) {
              return false;
            }
            const sourceRow = optionalById.get(row.rowId);
            return sourceRow ? isRowSelectable(sourceRow) : false;
          })
          .flatMap((row) => row.transactions);
        return [...validTransactions, ...selectedTransactions];
      });

      const uniqueTransactions = Array.from(
        new Map(allTransactions.map((tx) => [tx.id, tx])).values()
      );

      if (uniqueTransactions.length === 0) {
        setFormError("Nenhuma transacao valida encontrada.");
        return;
      }

      const { written, batches } = await upsertTransactions(
        db,
        effectiveUid,
        uniqueTransactions
      );
      setImportMessage(
        `Transacoes importadas: ${written}. Batches: ${batches}.`
      );
      clearImportReview();
    } catch (error) {
      setFormError("Nao foi possivel importar o arquivo. Tente novamente.");
      if (import.meta.env.DEV) {
        console.error("[import] falha na importacao", error);
      }
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    setSelectedFiles([]);
    setOutcomes([]);
    setImportSessionId(null);
    setFormError("");
    setImportMessage("");
    setSelectedCardId("");
    setSelectedRowIdsByFile({});
    setVisibleReviewRows({});
    setReviewTabByFile({});
    setRestoreNotice("");
    clearImportReview();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <AppShell title="Importar transacoes" subtitle="Importacao">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Envie o arquivo de lancamentos
              </h2>
              <p className="text-sm text-slate-600">
                Formato recomendado: CSV. A importacao nao altera seus
                lancamentos ate voce revisar os resultados.
              </p>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Arquivo de transacoes
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  multiple
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100"
                  onChange={(event) =>
                    setSelectedFiles(
                      event.currentTarget.files
                        ? Array.from(event.currentTarget.files)
                        : []
                    )
                  }
                />
              </label>

              {needsCardSelection ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Cartao Nubank
                  </span>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={selectedCardId}
                    onChange={(event) => setSelectedCardId(event.target.value)}
                    disabled={cards.length === 0}
                  >
                    <option value="">Selecione um cartao</option>
                    {cards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {selectedFiles.length > 0 ? (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <p className="font-semibold">Arquivos selecionados</p>
                  <ul className="mt-2 space-y-1 text-xs text-emerald-700">
                    {selectedFiles.map((file) => (
                      <li key={file.name}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {selectedFiles.some((file) => isNubankCardFile(file.name)) &&
              cards.length === 0 ? (
                <p className="text-xs text-amber-600">
                  Cadastre um cartao para importar arquivos Nubank.
                </p>
              ) : null}

              {formError ? (
                <p className="text-sm text-rose-500">{formError}</p>
              ) : null}

              {importMessage ? (
                <p className="text-sm text-emerald-600">{importMessage}</p>
              ) : null}

              {restoreNotice ? (
                <p className="text-xs text-amber-600">{restoreNotice}</p>
              ) : null}

              {!canWrite ? (
                <p className="text-xs text-amber-600">
                  Importacao bloqueada durante a impersonacao.
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={handleAnalyze}
                  loading={analyzing}
                  disabled={
                    selectedFiles.length === 0 ||
                    (needsCardSelection && !selectedCardId) ||
                    (selectedFiles.some((file) => isNubankCardFile(file.name)) &&
                      cards.length === 0)
                  }
                >
                  Analisar arquivos
                </Button>
                <Button
                  type="button"
                  onClick={handleImport}
                  loading={importing}
                  disabled={!canWrite || successfulOutcomes.length === 0}
                >
                  Importar transacoes
                </Button>
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Limpar
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Resultado por arquivo
              </h2>
              <p className="text-sm text-slate-600">
                Analise o resultado antes de confirmar a importacao.
              </p>
            </div>

            {outcomes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Nenhum arquivo analisado ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {outcomes.map((outcome) => {
                  const selectedIds =
                    outcome.status === "success"
                      ? getSelectedRowIds(outcome.fileName)
                      : new Set<string>();
                  const selectedWarnings =
                    outcome.status === "success"
                      ? outcome.result.warnings.filter(
                          (row) =>
                            selectedIds.has(row.rowId) &&
                            isRowSelectable(row as ReviewRow)
                        ).length
                      : 0;
                  const selectedIgnored =
                    outcome.status === "success"
                      ? outcome.result.ignored.filter(
                          (row) =>
                            selectedIds.has(row.rowId) &&
                            isRowSelectable(row as ReviewRow)
                        ).length
                      : 0;

                  return (
                  <div
                    key={outcome.fileName}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                          statusStyles[outcome.status]
                        }`}
                      >
                        {statusLabels[outcome.status]}
                      </span>
                      <span className="text-xs text-slate-500">
                        {outcome.fileName}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-800">
                      {outcome.status === "success"
                        ? `${outcome.result.counts.valid} transacoes validas${
                            outcome.projectedCount > 0
                              ? ` (+${outcome.projectedCount} projetadas)`
                              : ""
                          }`
                        : outcome.message}
                    </p>
                    {outcome.status === "success" ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Avisos: {outcome.result.counts.warnings} ({selectedWarnings}{" "}
                        selecionados p/ importar). Ignoradas:{" "}
                        {outcome.result.counts.ignored} ({selectedIgnored} selecionadas p/
                        importar).
                      </p>
                    ) : null}
                  </div>
                );
                })}
              </div>
            )}

            {totalTransactions > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                Total de transacoes prontas para importar: {totalTransactions}
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      {successfulOutcomes.length > 0 ? (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Revisao por arquivo
          </h2>
          <p className="text-sm text-slate-500">
            Revise validas, avisos e ignoradas antes de importar.
          </p>

          <div className="mt-4 space-y-6">
            {successfulOutcomes.map((outcome) => {
              const activeTab = reviewTabByFile[outcome.fileName] ?? "valid";
              const rows =
                activeTab === "valid"
                  ? (outcome.result.validRows ?? [])
                  : activeTab === "warning"
                    ? outcome.result.warnings
                    : outcome.result.ignored;
              const visibleCount = getVisibleCount(outcome.fileName, activeTab);
              const displayRows = rows.slice(0, visibleCount) as ReviewRow[];
              const selectedIds = getSelectedRowIds(outcome.fileName);

              return (
                <div key={`${outcome.fileName}-review`} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {outcome.fileName}
                    </p>
                    <span className="text-xs text-slate-500">
                      {outcome.result.counts.valid} validas -{" "}
                      {outcome.result.counts.warnings} avisos -{" "}
                      {outcome.result.counts.ignored} ignoradas
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {([
                      { key: "valid", label: "Validas" },
                      { key: "warning", label: "Avisos" },
                      { key: "ignored", label: "Ignoradas" },
                    ] as const).map((tab) => {
                      const isActive = activeTab === tab.key;
                      const count =
                        tab.key === "valid"
                          ? outcome.result.validRows?.length ?? 0
                          : tab.key === "warning"
                            ? outcome.result.warnings.length
                            : outcome.result.ignored.length;
                      return (
                        <button
                          key={`${outcome.fileName}-${tab.key}`}
                          type="button"
                          onClick={() =>
                            setReviewTabByFile((prev) => ({
                              ...prev,
                              [outcome.fileName]: tab.key,
                            }))
                          }
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {tab.label} ({count})
                        </button>
                      );
                    })}
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                        <tr>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Data</th>
                          <th className="px-3 py-2">Descricao</th>
                          <th className="px-3 py-2">Valor</th>
                          <th className="px-3 py-2">Motivo</th>
                          <th className="px-3 py-2">Raw</th>
                          <th className="px-3 py-2 text-right">Acao</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm text-slate-700">
                        {displayRows.length === 0 ? (
                          <tr>
                            <td className="px-3 py-3 text-sm text-slate-500" colSpan={7}>
                              Nenhuma linha nesta categoria.
                            </td>
                          </tr>
                        ) : (
                          displayRows.map((row) => {
                            const statusLabel =
                              row.status === "valid"
                                ? "Valida"
                                : row.status === "warning"
                                  ? "Aviso"
                                  : "Ignorada";
                            const statusStyle =
                              row.status === "valid"
                                ? "bg-emerald-100 text-emerald-700"
                                : row.status === "warning"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-200 text-slate-700";
                            const descriptionValue = resolveRowDescription(row);
                            const dateValue = resolveRowDateISO(row);
                            const amountValue = resolveRowAmountCents(row);
                            const canEditDescription =
                              row.reasonCode === "MISSING_DESCRIPTION";
                            const canEditDate =
                              row.reasonCode === "MISSING_DATE" ||
                              row.reasonCode === "INVALID_DATE";
                            const canEditAmount =
                              row.reasonCode === "MISSING_AMOUNT" ||
                              row.reasonCode === "INVALID_AMOUNT";
                            const isCardPayment = row.reasonCode === "CARD_PAYMENT";
                            const selectable = isRowSelectable(row);
                            const isSelected = selectedIds.has(row.rowId);

                            return (
                              <tr key={`${outcome.fileName}-${row.rowId}`}>
                                <td className="px-3 py-2">
                                  <span
                                    className={`rounded-full px-2 py-1 text-xs ${statusStyle}`}
                                  >
                                    {statusLabel}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  {canEditDate ? (
                                    <input
                                      type="date"
                                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                                      value={dateValue}
                                      onChange={(event) =>
                                        updateRowDate(
                                          outcome.fileName,
                                          row,
                                          event.target.value
                                        )
                                      }
                                    />
                                  ) : (
                                    dateValue || "-"
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {canEditDescription ? (
                                    <input
                                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                                      value={descriptionValue}
                                      onChange={(event) =>
                                        updateRowDescription(
                                          outcome.fileName,
                                          row,
                                          event.target.value
                                        )
                                      }
                                      placeholder="Descricao"
                                    />
                                  ) : (
                                    descriptionValue || "-"
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {canEditAmount ? (
                                    <input
                                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                                      value={
                                        amountValue !== undefined
                                          ? formatCentsToInput(amountValue)
                                          : ""
                                      }
                                      onChange={(event) =>
                                        updateRowAmount(
                                          outcome.fileName,
                                          row,
                                          event.target.value
                                        )
                                      }
                                      placeholder="0,00"
                                    />
                                  ) : (
                                    getRowDisplay(row).amount
                                  )}
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-500">
                                  <div className="font-semibold text-slate-600">
                                    {row.reasonCode}
                                  </div>
                                  <div>{row.reasonMessage}</div>
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-500">
                                  <details>
                                    <summary className="cursor-pointer text-emerald-600">
                                      Ver raw
                                    </summary>
                                    <pre className="mt-2 max-w-xs whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
                                      {JSON.stringify(row.raw, null, 2)}
                                    </pre>
                                  </details>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex flex-col items-end gap-2 text-xs text-slate-600">
                                    {row.status === "valid" ? (
                                      <label className="inline-flex items-center gap-2">
                                        <input type="checkbox" checked disabled />
                                        <span>Incluida</span>
                                      </label>
                                    ) : (
                                      <>
                                        {isCardPayment ? (
                                          <label className="inline-flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={Boolean(row.userIncluded)}
                                              onChange={(event) =>
                                                updateRowCardPayment(
                                                  outcome.fileName,
                                                  row,
                                                  event.target.checked
                                                )
                                              }
                                            />
                                            <span>Incluir como transferencia</span>
                                          </label>
                                        ) : null}
                                        {selectable ? (
                                          <label className="inline-flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={(event) =>
                                                toggleRowSelection(
                                                  outcome.fileName,
                                                  row.rowId,
                                                  event.target.checked
                                                )
                                              }
                                            />
                                            <span>Incluir na importacao</span>
                                          </label>
                                        ) : (
                                          <span className="text-slate-400">
                                            Nao importavel
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {rows.length > visibleCount ? (
                    <div className="mt-2 flex">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => showMoreRows(outcome.fileName, activeTab)}
                      >
                        Mostrar mais
                      </Button>
                    </div>
                  ) : null}

                  {(() => {
                    const selectedRows = outcome.preparedOptional.filter((row) =>
                      selectedIds.has(row.rowId)
                    );
                    if (selectedRows.length === 0) {
                      return null;
                    }
                    return (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Selecionadas para importar
                        </p>
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="text-xs uppercase text-slate-400">
                              <tr>
                                <th className="py-2">Data</th>
                                <th className="py-2">Descricao</th>
                                <th className="py-2">Categoria</th>
                                <th className="py-2 text-right">Valor</th>
                              </tr>
                            </thead>
                            <tbody className="text-sm text-slate-700">
                              {selectedRows.map((row) => (
                                <tr key={`${outcome.fileName}-selected-${row.rowId}`}>
                                  <td className="py-2">{row.preview.dateISO}</td>
                                  <td className="py-2">
                                    {row.preview.description || "-"}
                                    {row.preview.installmentLabel ? (
                                      <span className="ml-2 text-xs text-slate-400">
                                        Parcela {row.preview.installmentLabel}
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="py-2">{row.preview.categoryName}</td>
                                  <td className="py-2 text-right">
                                    {formatAmountLabel(
                                      row.preview.kind,
                                      row.preview.amountCents
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
    </AppShell>
  );
};

export default ImportTransactionsPage;

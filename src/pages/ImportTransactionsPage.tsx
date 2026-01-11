import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "../components/AppShell";
import Button from "../components/Button";
import Card from "../components/Card";
import { importUploadedFiles } from "../ingestion/importUploadedFiles";
import type { FileParseOutcome, ParseResult } from "../ingestion/core/types";
import { upsertTransactions } from "../ingestion/firestoreUpsert";
import { getInvoiceMonthKey, getMonthKeyFromDateISO, shiftMonthKey } from "../lib/date";
import type {
  Card as CardType,
  Category,
  MerchantCategoryRule,
  PaymentMethod,
  Transaction,
} from "../lib/firestore";
import {
  listCards,
  listCategories,
  listMerchantCategoryRules,
  seedDefaultCategories,
} from "../lib/firestore";
import { formatCurrency } from "../lib/money";
import { db } from "../lib/firebase";
import { useAdmin } from "../providers/AdminProvider";
import { categorizeTransaction, DEFAULT_CATEGORY_SEED } from "../lib/categorizeTransaction";
import { normalizeText } from "../lib/normalizeText";
import { parseInstallments } from "../lib/parseInstallments";
import { hashStringSha256 } from "../lib/hash";
import { buildMerchantKey } from "../lib/merchantRules";

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
  type: "income" | "expense";
  categoryName: string;
  invoiceMonthKey?: string;
  installmentLabel?: string;
};

type ImportOutcomeSuccess = {
  status: "success";
  fileName: string;
  parserId: string;
  result: ParseResult;
  preview: ImportPreviewTransaction[];
  preparedTransactions: Transaction[];
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

const formatAmountLabel = (type: "income" | "expense", amountCents: number) =>
  `${type === "income" ? "+" : "-"} ${formatCurrency(amountCents)}`;

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
  const { effectiveUid, isImpersonating } = useAdmin();
  const canWrite = Boolean(effectiveUid) && !isImpersonating;

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

  const successfulOutcomes = useMemo(
    () => outcomes.filter((outcome) => outcome.status === "success"),
    [outcomes]
  ) as ImportOutcomeSuccess[];

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
      successfulOutcomes.reduce(
        (sum, outcome) => sum + outcome.preparedTransactions.length,
        0
      ),
    [successfulOutcomes]
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

  const resolveCategoryId = (categoryKey: string | undefined, kind: "income" | "expense") => {
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

    const isCardFile = outcome.parserId === "csv-nubank" && isNubankCardFile(outcome.fileName);
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

    const preparedTransactions: Transaction[] = [];
    const preview: ImportPreviewTransaction[] = [];
    let projectedCount = 0;

    for (const tx of outcome.result.transactions) {
      const rawDescription = tx.description?.trim() || tx.name?.trim() || "";
      const extraDescription = tx.extraDescription?.trim() || "";
      const descriptionSeed = rawDescription || extraDescription;
      const baseDescription = descriptionSeed || "Sem descricao";
      const kind = tx.type;

      const merchantKey = descriptionSeed ? buildMerchantKey(descriptionSeed) : "";
      const merchantCategoryId = merchantKey
        ? merchantRulesByKey.get(merchantKey)
        : undefined;
      const suggestion = categorizeTransaction(
        rawDescription,
        extraDescription,
        tx.amountCents,
        kind
      );
      const suggestedCategoryId =
        merchantCategoryId ?? resolveCategoryId(suggestion.categoryKey, kind);
      const categoryName = resolveCategoryName(suggestedCategoryId);

      const installmentInfo =
        paymentMethod === "card" ? parseInstallments(rawDescription) : null;
      const installmentTotal =
        installmentInfo && installmentInfo.installmentTotal > 1
          ? installmentInfo.installmentTotal
          : undefined;
      const installmentIndex = installmentInfo?.installmentIndex;
      const description =
        installmentInfo?.baseDescription?.trim() || baseDescription;

      const invoiceMonthKey =
        paymentMethod === "card" && card
          ? getInvoiceMonthKey(tx.dateISO, card.closingDay)
          : undefined;
      const monthKey = getMonthKeyFromDateISO(tx.dateISO);

      const canProject =
        paymentMethod === "card" &&
        cardId &&
        invoiceMonthKey &&
        installmentTotal &&
        installmentIndex &&
        kind === "expense";

      let installmentGroupId: string | undefined = undefined;
      let resolvedId = tx.idempotencyKey ?? `imp-${sessionId}-${tx.rowIndex}`;

      if (canProject) {
        installmentGroupId = await buildInstallmentGroupId(
          uid,
          cardId,
          description,
          tx.amountCents,
          installmentTotal
        );
        resolvedId = await buildInstallmentTxId(
          uid,
          outcome.parserId,
          cardId,
          installmentGroupId,
          installmentIndex,
          invoiceMonthKey
        );
      }

      const baseTransaction: Transaction = {
        id: resolvedId,
        type: kind,
        kind,
        paymentMethod,
        amountCents: tx.amountCents,
        date: tx.dateISO,
        monthKey,
        invoiceMonthKey,
        description,
        name: tx.name,
        documentNumber: tx.documentNumber,
        categoryId: suggestedCategoryId,
        cardId,
        statementMonthKey: invoiceMonthKey,
        importSessionId: sessionId,
        importFileName: outcome.fileName,
        idempotencyKey: tx.idempotencyKey ?? resolvedId,
        installmentGroupId,
        installmentIndex: canProject ? installmentIndex : undefined,
        installmentCount: canProject ? installmentTotal : undefined,
        installmentTotal: canProject ? installmentTotal : undefined,
        installmentsTotal: canProject ? installmentTotal : undefined,
        isProjected: canProject ? false : undefined,
      };

      preparedTransactions.push(baseTransaction);

      const installmentLabel = canProject
        ? `${installmentIndex}/${installmentTotal}`
        : undefined;

      preview.push({
        id: baseTransaction.id,
        dateISO: tx.dateISO,
        description,
        amountCents: tx.amountCents,
        type: kind,
        categoryName,
        invoiceMonthKey,
        installmentLabel,
      });

      if (
        canProject &&
        installmentTotal &&
        installmentIndex < installmentTotal &&
        installmentGroupId
      ) {
        for (let index = installmentIndex + 1; index <= installmentTotal; index += 1) {
          const projectedInvoiceMonthKey = shiftMonthKey(
            invoiceMonthKey,
            index - installmentIndex
          );
          const projectedDate = `${projectedInvoiceMonthKey}-01`;
          const projectedId = await buildInstallmentTxId(
            uid,
            outcome.parserId,
            cardId,
            installmentGroupId,
            index,
            projectedInvoiceMonthKey
          );

          preparedTransactions.push({
            id: projectedId,
            type: "expense",
            kind: "expense",
            paymentMethod: "card",
            amountCents: tx.amountCents,
            date: projectedDate,
            monthKey: projectedInvoiceMonthKey,
            invoiceMonthKey: projectedInvoiceMonthKey,
            description: `${description} Parcela ${index}/${installmentTotal}`,
            categoryId: suggestedCategoryId,
            cardId,
            statementMonthKey: projectedInvoiceMonthKey,
            importSessionId: sessionId,
            importFileName: outcome.fileName,
            idempotencyKey: projectedId,
            installmentGroupId,
            installmentIndex: index,
            installmentCount: installmentTotal,
            installmentTotal: installmentTotal,
            installmentsTotal: installmentTotal,
            isProjected: true,
          });

          projectedCount += 1;
        }
      }
    }

    return {
      status: "success",
      fileName: outcome.fileName,
      parserId: outcome.parserId,
      result: outcome.result,
      preview: preview.slice(0, 20),
      preparedTransactions,
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

      if (import.meta.env.DEV) {
        console.log(
          "[import] outcomes",
          enriched.map((outcome) => ({
            fileName: outcome.fileName,
            status: outcome.status,
            count: outcome.status === "success" ? outcome.result.transactions.length : 0,
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
      const allTransactions = successfulOutcomes.flatMap(
        (outcome) => outcome.preparedTransactions
      );

      if (allTransactions.length === 0) {
        setFormError("Nenhuma transacao valida encontrada.");
        return;
      }

      const { written, batches } = await upsertTransactions(
        db,
        effectiveUid,
        allTransactions
      );
      setImportMessage(
        `Transacoes importadas: ${written}. Batches: ${batches}.`
      );
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
                {outcomes.map((outcome) => (
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
                        ? `${outcome.result.transactions.length} transacoes validas${
                            outcome.projectedCount > 0
                              ? ` (+${outcome.projectedCount} projetadas)`
                              : ""
                          }`
                        : outcome.message}
                    </p>
                    {outcome.status === "success" ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Ignoradas: {outcome.result.skipped}. Avisos:{" "}
                        {outcome.result.warnings.length}.
                      </p>
                    ) : null}
                  </div>
                ))}
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
            Preview das transacoes (ate 20 por arquivo)
          </h2>
          <p className="text-sm text-slate-500">
            Verifique os dados antes de confirmar a importacao.
          </p>

          <div className="mt-4 space-y-6">
            {successfulOutcomes.map((outcome) => (
              <div key={`${outcome.fileName}-preview`} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {outcome.fileName}
                  </p>
                  <span className="text-xs text-slate-500">
                    {outcome.result.transactions.length} transacoes
                    {outcome.projectedCount > 0
                      ? ` (+${outcome.projectedCount} parcelas futuras)`
                      : ""}
                  </span>
                </div>
                <div className="overflow-x-auto">
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
                      {outcome.preview.map((tx) => (
                        <tr key={`${outcome.fileName}-${tx.id}`}>
                          <td className="py-2">{tx.dateISO}</td>
                          <td className="py-2">
                            {tx.description || "-"}
                            {tx.installmentLabel ? (
                              <span className="ml-2 text-xs text-slate-400">
                                Parcela {tx.installmentLabel}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2">{tx.categoryName}</td>
                          <td className="py-2 text-right">
                            {formatAmountLabel(tx.type, tx.amountCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </AppShell>
  );
};

export default ImportTransactionsPage;

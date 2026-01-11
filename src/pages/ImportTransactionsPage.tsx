import { useMemo, useRef, useState } from "react";
import AppShell from "../components/AppShell";
import Button from "../components/Button";
import Card from "../components/Card";
import { importUploadedFiles } from "../ingestion/importUploadedFiles";
import type { FileParseOutcome, NormalizedTransaction } from "../ingestion/core/types";
import { upsertTransactions } from "../ingestion/firestoreUpsert";
import { getMonthKeyFromDateISO } from "../lib/date";
import type { Transaction } from "../lib/firestore";
import { formatCurrency } from "../lib/money";
import { db } from "../lib/firebase";
import { useAdmin } from "../providers/AdminProvider";

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

const mapTransactionsToFirestore = (
  outcome: FileParseOutcome,
  importSessionId: string
) => {
  if (outcome.status !== "success") {
    return [];
  }

  return outcome.result.transactions.map((tx) => {
    const id = tx.idempotencyKey ?? `imp-${importSessionId}-${tx.rowIndex}`;
    return {
      id,
      type: tx.type,
      paymentMethod: "cash",
      amountCents: tx.amountCents,
      date: tx.dateISO,
      monthKey: getMonthKeyFromDateISO(tx.dateISO),
      description: tx.description,
      name: tx.name,
      documentNumber: tx.documentNumber,
      importSessionId,
      importFileName: outcome.fileName,
      idempotencyKey: tx.idempotencyKey ?? id,
    } satisfies Transaction;
  });
};

const formatAmountLabel = (tx: NormalizedTransaction) =>
  `${tx.type === "income" ? "+" : "-"} ${formatCurrency(tx.amountCents)}`;

const ImportTransactionsPage = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [outcomes, setOutcomes] = useState<FileParseOutcome[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [formError, setFormError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [importSessionId, setImportSessionId] = useState<string | null>(null);
  const { effectiveUid, isImpersonating } = useAdmin();
  const canWrite = Boolean(effectiveUid) && !isImpersonating;

  const successfulOutcomes = useMemo(
    () => outcomes.filter((outcome) => outcome.status === "success"),
    [outcomes]
  );

  const totalTransactions = useMemo(
    () =>
      successfulOutcomes.reduce(
        (sum, outcome) => sum + outcome.result.transactions.length,
        0
      ),
    [successfulOutcomes]
  );

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0) {
      setFormError("Selecione um arquivo para importar.");
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
      setOutcomes(results);

      if (import.meta.env.DEV) {
        console.log(
          "[import] outcomes",
          results.map((outcome) => ({
            fileName: outcome.fileName,
            status: outcome.status,
            count:
              outcome.status === "success"
                ? outcome.result.transactions.length
                : 0,
          }))
        );
      } else {
        console.log("[import] outcomes", {
          totalFiles: results.length,
          success: results.filter((outcome) => outcome.status === "success").length,
          failed: results.filter((outcome) => outcome.status === "error").length,
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
      const allTransactions = successfulOutcomes.flatMap((outcome) =>
        mapTransactionsToFirestore(outcome, importSessionId)
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
                  disabled={selectedFiles.length === 0}
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
                        ? `${outcome.result.transactions.length} transacoes validas`
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
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-400">
                      <tr>
                        <th className="py-2">Data</th>
                        <th className="py-2">Descricao</th>
                        <th className="py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-slate-700">
                      {outcome.preview.map((tx) => (
                        <tr key={`${outcome.fileName}-${tx.rowIndex}`}>
                          <td className="py-2">{tx.dateISO}</td>
                          <td className="py-2">
                            {tx.description || tx.name || "-"}
                          </td>
                          <td className="py-2 text-right">
                            {formatAmountLabel(tx)}
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

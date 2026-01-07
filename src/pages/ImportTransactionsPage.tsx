import { useRef, useState } from "react";
import AppShell from "../components/AppShell";
import Button from "../components/Button";
import Card from "../components/Card";
import { normalizeHeader } from "../ingestion/csv";
import { upsertTransactions } from "../ingestion/firestoreUpsert";
import { importUploadedFiles } from "../ingestion/importUploadedFiles";
import type { ParsedCsv } from "../ingestion/types";
import type { Transaction } from "../lib/firestore";
import { db } from "../lib/firebase";
import { getMonthKeyFromDateISO } from "../lib/date";
import { parseAmountToCents } from "../lib/money";
import { useAdmin } from "../providers/AdminProvider";

const statusStyles = {
  success: "text-emerald-600",
  warning: "text-amber-600",
  error: "text-rose-600",
};

const statusLabels = {
  success: "Sucesso",
  warning: "Atencao",
  error: "Erro",
};

type LogEntry = {
  id: string;
  status: "success" | "warning" | "error";
  message: string;
  detail?: string;
  timestamp: string;
};

type BuildResult = {
  transactions: Transaction[];
  skipped: number;
};

const parseDateInput = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/^(\\d{2})[./-](\\d{2})[./-](\\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  return null;
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
};

const createImportId = (parserId: string, row: string[]) => {
  const rawKey = [parserId, ...row].join("|");
  return `${parserId}-${hashString(rawKey)}`;
};

const buildTransactionsFromParsed = (parsed: ParsedCsv): BuildResult => {
  const normalizedHeader = normalizeHeader(parsed.header);
  const dateIndex = normalizedHeader.indexOf("data");
  const amountIndex = normalizedHeader.indexOf("valor");
  const descriptionIndex = normalizedHeader.findIndex((value) =>
    ["descricao", "historico"].includes(value)
  );
  const categoryIndex = normalizedHeader.indexOf("categoria");

  let skipped = 0;
  const transactions: Transaction[] = [];

  parsed.rows.forEach((row) => {
    const dateRaw = dateIndex >= 0 ? row[dateIndex] ?? "" : "";
    const amountRaw = amountIndex >= 0 ? row[amountIndex] ?? "" : "";
    const dateISO = parseDateInput(dateRaw);
    const parsedAmount = parseAmountToCents(amountRaw);

    if (!dateISO || parsedAmount === null || parsedAmount === 0) {
      skipped += 1;
      return;
    }

    const amountCents = Math.abs(parsedAmount);
    const type = parsedAmount < 0 ? "expense" : "income";
    const description =
      descriptionIndex >= 0 ? row[descriptionIndex]?.trim() ?? "" : "";
    const categoryLabel =
      categoryIndex >= 0 ? row[categoryIndex]?.trim() ?? "" : "";

    transactions.push({
      id: createImportId(parsed.parserId, row),
      type,
      paymentMethod: "cash",
      amountCents,
      date: dateISO,
      monthKey: getMonthKeyFromDateISO(dateISO),
      description: description || undefined,
      name: categoryLabel || undefined,
    });
  });

  return { transactions, skipped };
};

const dedupeTransactions = (transactions: Transaction[]) =>
  Array.from(new Map(transactions.map((tx) => [tx.id, tx])).values());

const ImportTransactionsPage = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const { effectiveUid } = useAdmin();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setFormError("Selecione um arquivo para importar.");
      return;
    }

    setUploading(true);
    setFormError("");

    try {
      const results = await importUploadedFiles([selectedFile]);
      const entries: LogEntry[] = [];

      for (const result of results) {
        const timestamp = new Date().toLocaleString("pt-BR");

        if (result.status === "error") {
          entries.push({
            id: `${result.fileName}-${Date.now()}`,
            status: "error",
            message: `Falha ao importar ${result.fileName}.`,
            detail: result.error,
            timestamp,
          });
          continue;
        }

        if (!effectiveUid) {
          entries.push({
            id: `${result.fileName}-${Date.now()}`,
            status: "error",
            message: `Nao foi possivel identificar o usuario.`,
            detail: "Conecte-se novamente antes de importar.",
            timestamp,
          });
          continue;
        }

        const { transactions, skipped } = buildTransactionsFromParsed(
          result.parsed
        );
        const deduped = dedupeTransactions(transactions);

        if (deduped.length === 0) {
          entries.push({
            id: `${result.fileName}-${Date.now()}`,
            status: "warning",
            message: `Nenhuma transacao valida encontrada em ${result.fileName}.`,
            detail: skipped
              ? `${skipped} linha(s) ignoradas por falta de dados.`
              : "Verifique o formato do arquivo.",
            timestamp,
          });
          continue;
        }

        const { written, batches } = await upsertTransactions(
          db,
          effectiveUid,
          deduped
        );

        entries.push({
          id: `${result.fileName}-${Date.now()}`,
          status: "success",
          message: `Transacoes importadas de ${result.fileName}.`,
          detail: `Gravadas ${written} de ${deduped.length}. Batches: ${batches}. Ignoradas: ${skipped}.`,
          timestamp,
        });
      }

      setLogs((prev) => [...entries, ...prev]);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setFormError("Nao foi possivel importar o arquivo. Tente novamente.");
    } finally {
      setUploading(false);
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
                Formatos recomendados: CSV ou OFX. A importacao nao altera seus
                lancamentos ate voce revisar os resultados.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Arquivo de transacoes
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.ofx"
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100"
                  onChange={(event) =>
                    setSelectedFile(event.currentTarget.files?.[0] ?? null)
                  }
                />
              </label>

              {selectedFile ? (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <p className="font-semibold">Arquivo selecionado</p>
                  <p>{selectedFile.name}</p>
                </div>
              ) : null}

              {formError ? (
                <p className="text-sm text-rose-500">{formError}</p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button type="submit" loading={uploading}>
                  Importar arquivo
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSelectedFile(null);
                    setFormError("");
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                >
                  Limpar
                </Button>
              </div>
            </form>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Log de importacao
              </h2>
              <p className="text-sm text-slate-600">
                Acompanhe aqui o status dos arquivos enviados e mensagens de
                validacao.
              </p>
            </div>

            {logs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Nenhum arquivo importado ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`text-xs font-semibold uppercase tracking-[0.2em] ${statusStyles[log.status]}`}
                      >
                        {statusLabels[log.status]}
                      </span>
                      <span className="text-xs text-slate-500">
                        {log.timestamp}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-800">
                      {log.message}
                    </p>
                    {log.detail ? (
                      <p className="mt-1 text-xs text-slate-500">{log.detail}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
};

export default ImportTransactionsPage;

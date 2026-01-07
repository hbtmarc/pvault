import { useRef, useState } from "react";
import AppShell from "../components/AppShell";
import Button from "../components/Button";
import Card from "../components/Card";

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

const ImportTransactionsPage = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setFormError("Selecione um arquivo para importar.");
      return;
    }

    setUploading(true);
    setFormError("");

    const timestamp = new Date().toLocaleString("pt-BR");
    const newEntry: LogEntry = {
      id: `${selectedFile.name}-${Date.now()}`,
      status: "success",
      message: `Arquivo ${selectedFile.name} enviado para processamento.`,
      detail: `Tamanho: ${(selectedFile.size / 1024).toFixed(1)} KB`,
      timestamp,
    };

    setLogs((prev) => [newEntry, ...prev]);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setUploading(false);
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

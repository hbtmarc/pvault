import { type ChangeEvent, useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorBanner from "../components/ErrorBanner";
import Input from "../components/Input";
import {
  type BackupPayload,
  type BackupProgress,
  type FirestoreErrorInfo,
  type UserProfile,
  exportUserData,
  getFirestoreErrorInfo,
  listUserProfiles,
  restoreUserData,
  wipeUserData,
} from "../lib/firestore";
import { useAdmin } from "../providers/AdminProvider";

const AdminPage = () => {
  const { authUid, effectiveUid, impersonate, isAdmin } = useAdmin();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [error, setError] = useState<FirestoreErrorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<FirestoreErrorInfo | null>(null);
  const [backupStatus, setBackupStatus] = useState("");
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState("");
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreMode, setRestoreMode] = useState<"replace" | "merge">("replace");
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [restoreFileName, setRestoreFileName] = useState("");
  const [restorePayload, setRestorePayload] = useState<BackupPayload | null>(null);
  const [wipeStatus, setWipeStatus] = useState("");
  const [wipeLoading, setWipeLoading] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState("");

  useEffect(() => {
    if (!authUid || !isAdmin) {
      return undefined;
    }

    const unsubscribe = listUserProfiles(
      authUid,
      (items) => {
        setError(null); // limpa erro anterior quando a leitura for autorizada
        setUsers(items);
        setLoading(false);
      },
      (err) => {
        setError(getFirestoreErrorInfo(err));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authUid, isAdmin]);

  useEffect(() => {
    setDataError(null);
    setBackupStatus("");
    setRestoreStatus("");
    setWipeStatus("");
    setRestorePayload(null);
    setRestoreFileName("");
    setRestoreConfirm("");
    setWipeConfirm("");
  }, [effectiveUid]);

  const busy = backupLoading || restoreLoading || wipeLoading;
  const targetUser = users.find((item) => item.uid === effectiveUid);
  const targetLabel = targetUser?.email || effectiveUid || "";

  const formatProgress = (progress: BackupProgress) => {
    const action =
      progress.stage === "read"
        ? "Lendo"
        : progress.stage === "write"
        ? "Gravando"
        : "Apagando";
    return `${action} ${progress.collection} (${progress.processed})`;
  };

  const handleBackup = async () => {
    if (!effectiveUid || busy) {
      return;
    }

    try {
      setDataError(null);
      setBackupLoading(true);
      setBackupStatus("Iniciando backup...");
      const payload = await exportUserData(effectiveUid, {
        onProgress: (progress) => setBackupStatus(formatProgress(progress)),
      });
      const dateLabel = new Date().toISOString().slice(0, 10);
      const fileName = `pvault-backup_${effectiveUid}_${dateLabel}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      setBackupStatus("Backup concluido.");
    } catch (err) {
      console.error("[admin] exportUserData", err);
      setDataError(getFirestoreErrorInfo(err));
      setBackupStatus("Falha ao gerar backup.");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setRestorePayload(null);
      setRestoreFileName("");
      return;
    }

    setRestoreFileName(file.name);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupPayload;
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid backup file");
      }
      setRestorePayload(parsed);
      setDataError(null);
      setRestoreStatus("Arquivo carregado.");
    } catch (err) {
      console.error("[admin] parse backup", err);
      setRestorePayload(null);
      setDataError({ message: "Arquivo de backup invalido." });
    }
  };

  const handleRestore = async () => {
    if (!effectiveUid || !restorePayload || busy) {
      return;
    }

    if (restoreMode === "replace" && restoreConfirm !== "RESTAURAR") {
      return;
    }

    try {
      setDataError(null);
      setRestoreLoading(true);
      setRestoreStatus("Iniciando restauracao...");
      if (restoreMode === "replace") {
        setRestoreStatus("Apagando dados atuais...");
        await wipeUserData(effectiveUid, {
          includeProfile: false,
          onProgress: (progress) => setRestoreStatus(formatProgress(progress)),
        });
      }
      await restoreUserData(effectiveUid, restorePayload, {
        merge: restoreMode === "merge",
        onProgress: (progress) => setRestoreStatus(formatProgress(progress)),
      });
      setRestoreStatus("Restauracao concluida.");
    } catch (err) {
      console.error("[admin] restoreUserData", err);
      setDataError(getFirestoreErrorInfo(err));
      setRestoreStatus("Falha ao restaurar backup.");
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleWipe = async (includeProfile: boolean) => {
    if (!effectiveUid || busy) {
      return;
    }

    if (wipeConfirm !== "APAGAR") {
      return;
    }

    try {
      setDataError(null);
      setWipeLoading(true);
      setWipeStatus("Iniciando limpeza...");
      await wipeUserData(effectiveUid, {
        includeProfile,
        onProgress: (progress) => setWipeStatus(formatProgress(progress)),
      });
      setWipeStatus(
        includeProfile
          ? "Dados removidos, incluindo perfil."
          : "Dados financeiros removidos."
      );
    } catch (err) {
      console.error("[admin] wipeUserData", err);
      setDataError(getFirestoreErrorInfo(err));
      setWipeStatus("Falha ao apagar dados.");
    } finally {
      setWipeLoading(false);
    }
  };

  const canRestore =
    Boolean(
      effectiveUid &&
        restorePayload &&
        (restoreMode !== "replace" || restoreConfirm === "RESTAURAR")
    ) && !busy;
  const canWipe = Boolean(effectiveUid && wipeConfirm === "APAGAR" && !busy);

  if (!isAdmin) {
    return null;
  }

  return (
    <AppShell title="Admin" subtitle="Usuarios cadastrados">
      <ErrorBanner info={error} className="mb-4" />
      <ErrorBanner info={dataError} className="mb-4" />

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Lista de usuarios</h2>
        <p className="text-sm text-slate-500">
          Selecione "Visualizar como" para navegar como outro usuario.
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Carregando...</p>
        ) : null}

        {!loading && users.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nenhum usuario encontrado.</p>
        ) : null}

        <div className="mt-4 space-y-3">
          {users.map((item) => {
            const isActive = effectiveUid === item.uid;

            return (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {item.email || "Sem email"}
                  </p>
                  <p className="text-xs text-slate-500">{item.uid}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isActive ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                      Ativo
                    </span>
                  ) : null}
                  <Button
                    variant="secondary"
                    onClick={() => impersonate(item.uid, item.email)}
                    disabled={isActive}
                  >
                    Visualizar como
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900">Controle de dados</h2>
        <p className="text-sm text-slate-500">
          Backup, restauracao e limpeza dos dados do usuario selecionado.
        </p>

        <div className="mt-4 rounded-xl border border-slate-100 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Usuario selecionado
          </p>
          <p className="text-sm font-semibold text-slate-900">
            {targetLabel || "Nenhum usuario selecionado"}
          </p>
          {effectiveUid ? (
            <p className="text-xs text-slate-500">{effectiveUid}</p>
          ) : null}
        </div>

        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-slate-100 bg-white px-4 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Backup</h3>
            <p className="text-xs text-slate-500">
              Gera um arquivo JSON com os dados do usuario.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                onClick={handleBackup}
                disabled={!effectiveUid || busy}
                loading={backupLoading}
              >
                Gerar backup
              </Button>
              {backupStatus ? (
                <span className="text-xs text-slate-500">{backupStatus}</span>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white px-4 py-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Restaurar backup
            </h3>
            <p className="text-xs text-slate-500">
              Substituir tudo apaga os dados atuais antes de restaurar.
            </p>
            <div className="mt-3 grid gap-3">
              <Input
                label="Arquivo de backup (.json)"
                type="file"
                accept="application/json,.json"
                onChange={handleRestoreFile}
                disabled={busy}
              />
              {restoreFileName ? (
                <p className="text-xs text-slate-500">
                  Arquivo: {restoreFileName}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="restoreMode"
                    value="replace"
                    checked={restoreMode === "replace"}
                    onChange={() => setRestoreMode("replace")}
                    disabled={busy}
                  />
                  Substituir tudo
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="restoreMode"
                    value="merge"
                    checked={restoreMode === "merge"}
                    onChange={() => setRestoreMode("merge")}
                    disabled={busy}
                  />
                  Mesclar
                </label>
              </div>
              {restoreMode === "replace" ? (
                <Input
                  label="Digite RESTAURAR para confirmar"
                  value={restoreConfirm}
                  onChange={(event) => setRestoreConfirm(event.target.value)}
                  disabled={busy}
                />
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleRestore}
                  disabled={!canRestore}
                  loading={restoreLoading}
                >
                  Restaurar
                </Button>
                {restoreStatus ? (
                  <span className="text-xs text-slate-500">{restoreStatus}</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white px-4 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Apagar dados</h3>
            <p className="text-xs text-slate-500">
              Remove dados financeiros. O perfil pode ser apagado opcionalmente.
            </p>
            <div className="mt-3 grid gap-3">
              <Input
                label="Digite APAGAR para confirmar"
                value={wipeConfirm}
                onChange={(event) => setWipeConfirm(event.target.value)}
                disabled={busy}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => handleWipe(false)}
                  disabled={!canWipe}
                  loading={wipeLoading}
                  className="bg-rose-600 hover:bg-rose-700"
                >
                  Apagar dados financeiros
                </Button>
                <Button
                  onClick={() => handleWipe(true)}
                  disabled={!canWipe}
                  loading={wipeLoading}
                  className="bg-rose-700 hover:bg-rose-800"
                >
                  Apagar tudo
                </Button>
                {wipeStatus ? (
                  <span className="text-xs text-slate-500">{wipeStatus}</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </AppShell>
  );
};

export default AdminPage;

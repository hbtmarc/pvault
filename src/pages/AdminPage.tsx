import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorBanner from "../components/ErrorBanner";
import {
  type FirestoreErrorInfo,
  type UserProfile,
  getFirestoreErrorInfo,
  listUserProfiles,
} from "../lib/firestore";
import { useAdmin } from "../providers/AdminProvider";

const AdminPage = () => {
  const { authUid, effectiveUid, impersonate, isAdmin } = useAdmin();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [error, setError] = useState<FirestoreErrorInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUid || !isAdmin) {
      return undefined;
    }

    const unsubscribe = listUserProfiles(
      authUid,
      (items) => {
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

  if (!isAdmin) {
    return null;
  }

  return (
    <AppShell title="Admin" subtitle="Usuarios cadastrados">
      <ErrorBanner info={error} className="mb-4" />

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
    </AppShell>
  );
};

export default AdminPage;
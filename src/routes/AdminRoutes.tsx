import { Outlet } from "react-router-dom";
import AppShell from "../components/AppShell";
import Card from "../components/Card";
import { getAdminUidSet } from "../lib/runtime/adminUids";
import { useAdmin } from "../providers/AdminProvider";
import { useAuth } from "../providers/AuthProvider";

const AdminGateMessage = ({ message }: { message: string }) => {
  return (
    <AppShell title="Admin" subtitle="Acesso restrito">
      <Card>
        <p className="text-sm text-slate-600">{message}</p>
      </Card>
    </AppShell>
  );
};

const AdminRoutes = () => {
  const { user, loading } = useAuth();
  const { isAdmin } = useAdmin();
  const adminUidSet = getAdminUidSet();
  const hasAdminConfig = adminUidSet.size > 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-3">
          <div className="h-3 w-40 animate-pulse rounded-full bg-slate-200" />
          <div className="h-3 w-56 animate-pulse rounded-full bg-slate-200" />
          <p className="text-sm text-slate-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AdminGateMessage message="Voce precisa estar autenticado." />;
  }

  if (import.meta.env.PROD && !hasAdminConfig) {
    return (
      <AdminGateMessage message="Configuracao de admin ausente no build. Verifique VITE_ADMIN_UIDS no workflow." />
    );
  }

  if (!isAdmin) {
    return <AdminGateMessage message="Voce nao tem permissao de admin." />;
  }

  return <Outlet />;
};

export default AdminRoutes;

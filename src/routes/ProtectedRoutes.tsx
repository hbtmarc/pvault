import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

const ProtectedRoutes = () => {
  const { user, loading } = useAuth();

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
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoutes;

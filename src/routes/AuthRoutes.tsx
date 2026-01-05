import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

const AuthRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">
        Verificando sessao...
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default AuthRoutes;

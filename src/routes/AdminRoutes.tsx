import { Navigate, Outlet } from "react-router-dom";
import { useAdmin } from "../providers/AdminProvider";

const AdminRoutes = () => {
  const { isAdmin } = useAdmin();

  if (!isAdmin) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
};

export default AdminRoutes;
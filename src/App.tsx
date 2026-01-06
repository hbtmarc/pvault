import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthRoutes from "./routes/AuthRoutes";
import ProtectedRoutes from "./routes/ProtectedRoutes";
import BudgetPage from "./pages/BudgetPage";
import CategoriesPage from "./pages/CategoriesPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RecurringPage from "./pages/RecurringPage";
import RegisterPage from "./pages/RegisterPage";
import TransactionsPage from "./pages/TransactionsPage";

const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AuthRoutes />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot" element={<ForgotPasswordPage />} />
        </Route>
        <Route element={<ProtectedRoutes />}>
          <Route path="/app" element={<HomePage />} />
          <Route path="/app/budget" element={<BudgetPage />} />
          <Route path="/app/transactions" element={<TransactionsPage />} />
          <Route path="/app/categories" element={<CategoriesPage />} />
          <Route path="/app/recurring" element={<RecurringPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
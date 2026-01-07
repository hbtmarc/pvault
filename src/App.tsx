import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthRoutes from "./routes/AuthRoutes";
import ProtectedRoutes from "./routes/ProtectedRoutes";
import AdminRoutes from "./routes/AdminRoutes";
import AdminPage from "./pages/AdminPage";
import BudgetPage from "./pages/BudgetPage";
import CardsPage from "./pages/CardsPage";
import CategoriesPage from "./pages/CategoriesPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RecurringPage from "./pages/RecurringPage";
import RegisterPage from "./pages/RegisterPage";
import StatementsPage from "./pages/StatementsPage";
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
          <Route path="/app/cards" element={<CardsPage />} />
          <Route path="/app/statements" element={<StatementsPage />} />
          <Route path="/app/transactions" element={<TransactionsPage />} />
          <Route path="/app/categories" element={<CategoriesPage />} />
          <Route path="/app/recurring" element={<RecurringPage />} />
          <Route element={<AdminRoutes />}>
            <Route path="/app/admin" element={<AdminPage />} />
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;

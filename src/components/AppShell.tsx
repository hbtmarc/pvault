import { type ReactNode, useState } from "react";
import { NavLink } from "react-router-dom";
import { signOutUser } from "../lib/auth";
import { useAdmin } from "../providers/AdminProvider";
import { useAuth } from "../providers/AuthProvider";
import Button from "./Button";

type AppShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

const AppShell = ({ title, subtitle, children }: AppShellProps) => {
  const { user } = useAuth();
  const { isAdmin, isImpersonating, impersonationLabel, stopImpersonation } =
    useAdmin();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      setSignOutError("");
      await signOutUser();
    } catch (error) {
      setSignOutError("Nao foi possivel sair. Tente novamente.");
    } finally {
      setSigningOut(false);
    }
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-1 text-sm font-medium transition ${
      isActive
        ? "bg-emerald-100 text-emerald-700"
        : "text-slate-600 hover:text-slate-900"
    }`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/60 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
              PVault
            </p>
            <p className="text-sm text-slate-600">{user?.email ?? ""}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            <NavLink to="/app" className={linkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/app/budget" className={linkClass}>
              Orcamento
            </NavLink>
            <NavLink to="/app/transactions" className={linkClass}>
              Lancamentos
            </NavLink>
            <NavLink to="/app/categories" className={linkClass}>
              Categorias
            </NavLink>
            <NavLink to="/app/recurring" className={linkClass}>
              Recorrencias
            </NavLink>
            {isAdmin ? (
              <NavLink to="/app/admin" className={linkClass}>
                Admin
              </NavLink>
            ) : null}
          </nav>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            {signOutError ? (
              <span className="text-xs text-rose-500">{signOutError}</span>
            ) : null}
            <Button onClick={handleSignOut} loading={signingOut}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      {isImpersonating ? (
        <div className="border-b border-amber-200 bg-amber-50/70">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-semibold text-amber-700">
              Modo Admin - Visualizando como {impersonationLabel}
            </span>
            <Button variant="secondary" onClick={stopImpersonation}>
              Sair
            </Button>
          </div>
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 space-y-1">
          {subtitle ? (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
              {subtitle}
            </p>
          ) : null}
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        </div>
        {children}
      </main>
    </div>
  );
};

export default AppShell;

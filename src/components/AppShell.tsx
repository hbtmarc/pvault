import { type ReactNode, useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { signOutUser } from "../lib/auth";
import { useAdmin } from "../providers/AdminProvider";
import { useAuth } from "../providers/AuthProvider";
import Button from "./Button";
import MonthToolbar from "./month/MonthToolbar";

type AppShellProps = {
  title: string;
  subtitle?: string;
  toolbarSlot?: ReactNode;
  children: ReactNode;
};

const AppShell = ({ title, subtitle, toolbarSlot, children }: AppShellProps) => {
  const { user } = useAuth();
  const { isAdmin, isImpersonating, impersonationLabel, stopImpersonation } =
    useAdmin();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);

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

  const buttonClass = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium transition ${
      active ? "bg-emerald-100 text-emerald-700" : "text-slate-600 hover:text-slate-900"
    }`;

  const menuItemClass =
    "block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-700";

  const isPathActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const isGroupActive = (paths: string[]) => paths.some((path) => isPathActive(path));

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!navRef.current) {
        return;
      }
      if (!navRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, []);

  useEffect(() => {
    setOpenMenu(null);
  }, [location.pathname]);

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
          <nav
            ref={navRef}
            className="flex flex-wrap items-center gap-2"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpenMenu(null);
              }
            }}
          >
            <NavLink to="/app" className={linkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/app/budget" className={linkClass}>
              Orcamento
            </NavLink>
            <div className="relative">
              <button
                type="button"
                className={buttonClass(
                  isGroupActive(["/app/cards", "/app/statements"]) ||
                    openMenu === "cards"
                )}
                aria-haspopup="menu"
                aria-expanded={openMenu === "cards"}
                onClick={() =>
                  setOpenMenu(openMenu === "cards" ? null : "cards")
                }
              >
                Cartoes <span className="ml-1 text-xs">v</span>
              </button>
              {openMenu === "cards" ? (
                <div
                  className="absolute left-0 z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
                  role="menu"
                >
                  <NavLink
                    to="/app/cards"
                    className={menuItemClass}
                    onClick={() => setOpenMenu(null)}
                  >
                    Cartoes
                  </NavLink>
                  <NavLink
                    to="/app/statements"
                    className={menuItemClass}
                    onClick={() => setOpenMenu(null)}
                  >
                    Faturas
                  </NavLink>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                type="button"
                className={buttonClass(
                  isGroupActive([
                    "/app/transactions",
                    "/app/categories",
                    "/app/recurring",
                  ]) || openMenu === "transactions"
                )}
                aria-haspopup="menu"
                aria-expanded={openMenu === "transactions"}
                onClick={() =>
                  setOpenMenu(openMenu === "transactions" ? null : "transactions")
                }
              >
                Lancamentos <span className="ml-1 text-xs">v</span>
              </button>
              {openMenu === "transactions" ? (
                <div
                  className="absolute left-0 z-20 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
                  role="menu"
                >
                  <NavLink
                    to="/app/transactions"
                    className={menuItemClass}
                    onClick={() => setOpenMenu(null)}
                  >
                    Lancamentos
                  </NavLink>
                  <NavLink
                    to="/app/categories"
                    className={menuItemClass}
                    onClick={() => setOpenMenu(null)}
                  >
                    Categorias
                  </NavLink>
                  <NavLink
                    to="/app/recurring"
                    className={menuItemClass}
                    onClick={() => setOpenMenu(null)}
                  >
                    Recorrencias
                  </NavLink>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                type="button"
                className={buttonClass(
                  isGroupActive(["/app/import", "/app/admin"]) ||
                    openMenu === "admin"
                )}
                aria-haspopup="menu"
                aria-expanded={openMenu === "admin"}
                onClick={() =>
                  setOpenMenu(openMenu === "admin" ? null : "admin")
                }
              >
                Admin <span className="ml-1 text-xs">v</span>
              </button>
              {openMenu === "admin" ? (
                <div
                  className="absolute left-0 z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
                  role="menu"
                >
                  <NavLink
                    to="/app/import"
                    className={menuItemClass}
                    onClick={() => setOpenMenu(null)}
                  >
                    Importar
                  </NavLink>
                  {isAdmin ? (
                    <NavLink
                      to="/app/admin"
                      className={menuItemClass}
                      onClick={() => setOpenMenu(null)}
                    >
                      Painel Admin
                    </NavLink>
                  ) : null}
                </div>
              ) : null}
            </div>
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
        <MonthToolbar rightSlot={toolbarSlot} />
        {children}
      </main>
    </div>
  );
};

export default AppShell;

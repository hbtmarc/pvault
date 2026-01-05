import { useState } from "react";
import Button from "../components/Button";
import Card from "../components/Card";
import { signOutUser } from "../lib/auth";
import { useAuth } from "../providers/AuthProvider";

const HomePage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await signOutUser();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-2xl animate-[fade-in_0.6s_ease-out]">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
              Area logada
            </p>
            <h1 className="text-2xl font-bold text-slate-900">Bem-vindo!</h1>
            <p className="text-sm text-slate-600">
              {user?.email
                ? `Voce esta conectado como ${user.email}.`
                : "Voce esta conectado."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Proximo passo</p>
              <p className="text-xs text-slate-500">
                Conecte os dados financeiros assim que o Sprint 1 comecar.
              </p>
              <Button className="mt-3 w-full" variant="secondary" disabled>
                Novo lancamento (em breve)
              </Button>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Resumo rapido</p>
              <p className="text-xs text-slate-500">
                Este painel exibira graficos e metas.
              </p>
              <Button className="mt-3 w-full" variant="secondary" disabled>
                Ver resumo (em breve)
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Sprint 0 concluido: autenticacao e infraestrutura.
            </p>
            <Button onClick={handleSignOut} loading={loading}>
              Sair
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default HomePage;

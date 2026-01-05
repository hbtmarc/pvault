import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import Input from "../components/Input";
import { getAuthErrorMessage, signIn } from "../lib/auth";

type FormErrors = {
  email?: string;
  password?: string;
  form?: string;
};

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FormErrors = {};

    if (!email.trim()) {
      nextErrors.email = "Informe seu e-mail.";
    }

    if (!password.trim()) {
      nextErrors.password = "Informe sua senha.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setLoading(true);
      setErrors({});
      await signIn(email.trim(), password);
    } catch (error) {
      setErrors({ form: getAuthErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md animate-[fade-up_0.6s_ease-out]">
        <div className="mb-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
            Sprint 0
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            Controle Financeiro
          </h1>
          <p className="text-sm text-slate-600">
            Entre com seu e-mail para acessar seus lancamentos.
          </p>
        </div>

        {errors.form ? (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {errors.form}
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email}
          />
          <Input
            label="Senha"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
          />

          <Button type="submit" className="w-full" loading={loading}>
            Entrar
          </Button>
        </form>

        <div className="mt-6 flex flex-col gap-2 text-sm text-slate-600">
          <Link className="text-emerald-600 hover:text-emerald-700" to="/forgot">
            Esqueci minha senha
          </Link>
          <span>
            Ainda nao tem conta?{" "}
            <Link
              className="font-semibold text-emerald-600 hover:text-emerald-700"
              to="/register"
            >
              Criar conta
            </Link>
          </span>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
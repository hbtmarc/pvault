import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import Input from "../components/Input";
import { getAuthErrorMessage, signUp } from "../lib/auth";

type FormErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
  form?: string;
};

const RegisterPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FormErrors = {};

    if (!email.trim()) {
      nextErrors.email = "Informe seu e-mail.";
    }

    if (!password.trim()) {
      nextErrors.password = "Crie uma senha.";
    }

    if (password && password.length < 6) {
      nextErrors.password = "Use pelo menos 6 caracteres.";
    }

    if (confirmPassword !== password) {
      nextErrors.confirmPassword = "As senhas precisam ser iguais.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setLoading(true);
      setErrors({});
      await signUp(email.trim(), password);
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
            Criar conta
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            Comece seu controle financeiro
          </h1>
          <p className="text-sm text-slate-600">
            Preencha os dados para criar seu acesso.
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
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
          />
          <Input
            label="Confirmar senha"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            error={errors.confirmPassword}
          />

          <Button type="submit" className="w-full" loading={loading}>
            Criar conta
          </Button>
        </form>

        <div className="mt-6 text-sm text-slate-600">
          Ja tem conta?{" "}
          <Link className="font-semibold text-emerald-600 hover:text-emerald-700" to="/login">
            Fazer login
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default RegisterPage;
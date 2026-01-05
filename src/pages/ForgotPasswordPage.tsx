import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import Input from "../components/Input";
import { getAuthErrorMessage, resetPassword } from "../lib/auth";

type FormErrors = {
  email?: string;
  form?: string;
};

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FormErrors = {};

    if (!email.trim()) {
      nextErrors.email = "Informe seu e-mail.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setLoading(true);
      setErrors({});
      await resetPassword(email.trim());
      setSent(true);
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
            Recuperar acesso
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Esqueci minha senha</h1>
          <p className="text-sm text-slate-600">
            Enviaremos um link para redefinir sua senha.
          </p>
        </div>

        {errors.form ? (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {errors.form}
          </div>
        ) : null}

        {sent ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            E-mail enviado! Confira sua caixa de entrada.
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
          <Button type="submit" className="w-full" loading={loading}>
            Enviar link
          </Button>
        </form>

        <div className="mt-6 text-sm text-slate-600">
          <Link className="font-semibold text-emerald-600 hover:text-emerald-700" to="/login">
            Voltar ao login
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
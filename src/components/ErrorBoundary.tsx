import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
};

const getLocationLabel = () => {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.hash || window.location.pathname || "";
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    if (import.meta.env.DEV) {
      console.error("[ui] ErrorBoundary", error, errorInfo);
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const location = getLocationLabel();
    const message =
      this.state.error?.message ?? "Erro inesperado ao renderizar a pagina.";

    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
        <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">
            Algo deu errado nesta tela
          </h1>
          <p className="text-sm text-slate-600">{message}</p>
          {location ? (
            <p className="text-xs text-slate-500">Rota: {location}</p>
          ) : null}
          {import.meta.env.DEV ? (
            <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-600">
              <p className="font-semibold">Stack trace</p>
              <pre className="mt-2 whitespace-pre-wrap">
                {this.state.error?.stack ?? "Sem stack"}
              </pre>
              {this.state.errorInfo?.componentStack ? (
                <>
                  <p className="mt-3 font-semibold">Component stack</p>
                  <pre className="mt-2 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Tente atualizar a pagina ou voltar mais tarde.
            </p>
          )}
          <button
            type="button"
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            onClick={() => window.location.reload()}
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;

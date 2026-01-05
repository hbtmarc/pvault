import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "primary" | "secondary";
};

const Button = ({
  loading,
  variant = "primary",
  className,
  disabled,
  children,
  ...props
}: ButtonProps) => {
  const baseStyles =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2";
  const variantStyles =
    variant === "secondary"
      ? "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      : "bg-emerald-600 text-white hover:bg-emerald-700";
  const disabledStyles =
    disabled || loading ? "cursor-not-allowed opacity-70" : "";

  return (
    <button
      className={`${baseStyles} ${variantStyles} ${disabledStyles} ${className ?? ""}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? "Carregando..." : children}
    </button>
  );
};

export default Button;

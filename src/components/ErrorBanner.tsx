import type { FirestoreErrorInfo } from "../lib/firestore";

type ErrorBannerProps = {
  info?: FirestoreErrorInfo | null;
  className?: string;
};

const ErrorBanner = ({ info, className }: ErrorBannerProps) => {
  if (!info?.message) {
    return null;
  }

  const details = [info.code, info.details].filter(Boolean).join(" ");

  return (
    <div
      className={`rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 ${
        className ?? ""
      }`}
    >
      <p>{info.message}</p>
      {import.meta.env.DEV && details ? (
        <p className="mt-1 text-xs text-rose-500">{details}</p>
      ) : null}
    </div>
  );
};

export default ErrorBanner;
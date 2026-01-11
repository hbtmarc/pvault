import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { AdminProvider } from "./providers/AdminProvider";
import { AuthProvider } from "./providers/AuthProvider";
import { cleanupLegacyCaches } from "./lib/runtime/cleanupLegacyCaches";
import ErrorBoundary from "./components/ErrorBoundary";

const RuntimeCleanup = () => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cleanupLegacyCaches({ timeoutMs: 2000, allowReload: false });
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return null;
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <AdminProvider>
          <RuntimeCleanup />
          <App />
        </AdminProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

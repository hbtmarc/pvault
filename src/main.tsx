import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { AdminProvider } from "./providers/AdminProvider";
import { AuthProvider } from "./providers/AuthProvider";
import { cleanupLegacyCaches } from "./lib/runtime/cleanupLegacyCaches";

const bootstrap = async () => {
  await cleanupLegacyCaches();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <AuthProvider>
        <AdminProvider>
          <App />
        </AdminProvider>
      </AuthProvider>
    </React.StrictMode>
  );
};

bootstrap();

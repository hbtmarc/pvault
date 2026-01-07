import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { AdminProvider } from "./providers/AdminProvider";
import { AuthProvider } from "./providers/AuthProvider";
import { unregisterServiceWorkersInDev } from "./lib/dev/unregisterServiceWorkers";

const bootstrap = async () => {
  if (import.meta.env.DEV) {
    await unregisterServiceWorkersInDev();
  }

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

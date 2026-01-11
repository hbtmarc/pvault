const CLEANUP_FLAG = "__pvault_cleaned__";

type CleanupOptions = {
  timeoutMs?: number;
  allowReload?: boolean;
};

const delay = (ms: number) =>
  new Promise<"timeout">((resolve) => {
    setTimeout(() => resolve("timeout"), ms);
  });

export const cleanupLegacyCaches = async (options: CleanupOptions = {}) => {
  if (typeof window === "undefined") {
    return;
  }

  const timeoutMs = options.timeoutMs ?? 2000;
  const allowReload = options.allowReload ?? false;
  const isDev = import.meta.env.DEV;
  const isGithubPages =
    import.meta.env.PROD && window.location.hostname.endsWith("github.io");

  if (!isDev && !isGithubPages) {
    return;
  }

  if (window.sessionStorage.getItem(CLEANUP_FLAG) === "1") {
    return;
  }

  if (!("serviceWorker" in navigator)) {
    return;
  }

  const runCleanup = async () => {
    let removedRegistrations = 0;
    let removedCaches = 0;
    let hadController = false;

    try {
      hadController = Boolean(navigator.serviceWorker.controller);
      const registrations = await navigator.serviceWorker.getRegistrations();
      const results = await Promise.all(
        registrations.map((registration) => registration.unregister())
      );
      removedRegistrations = results.filter(Boolean).length;

      if ("caches" in window) {
        const keys = await window.caches.keys();
        const results = await Promise.all(
          keys.map((key) => window.caches.delete(key))
        );
        removedCaches = results.filter(Boolean).length;
      }
    } catch (error) {
      console.log("[runtime] cleanupLegacyCaches failed", error);
    }

    console.log("[runtime] cleanupLegacyCaches", {
      removedRegistrations,
      removedCaches,
      hadController,
    });

    if (removedRegistrations > 0 || removedCaches > 0 || hadController) {
      window.sessionStorage.setItem(CLEANUP_FLAG, "1");
      if (allowReload) {
        window.location.reload();
      }
    }
  };

  const result = await Promise.race([runCleanup(), delay(timeoutMs)]);
  if (result === "timeout" && import.meta.env.DEV) {
    console.warn("[runtime] cleanupLegacyCaches timeout");
  }
};

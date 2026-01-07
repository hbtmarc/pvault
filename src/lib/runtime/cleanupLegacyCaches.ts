const CLEANUP_FLAG = "__pvault_cleaned__";

export const cleanupLegacyCaches = async () => {
  if (typeof window === "undefined") {
    return;
  }

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
    window.location.reload();
  }
};

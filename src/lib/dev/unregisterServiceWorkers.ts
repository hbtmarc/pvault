export const unregisterServiceWorkersInDev = async () => {
  if (!import.meta.env.DEV) {
    return;
  }

  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const hadController = Boolean(navigator.serviceWorker.controller);
    const registrations = await navigator.serviceWorker.getRegistrations();
    const unregisterResults = await Promise.all(
      registrations.map((registration) => registration.unregister())
    );
    const removedRegistrations = unregisterResults.filter(Boolean).length;

    let removedCaches = 0;
    if (typeof window !== "undefined" && "caches" in window) {
      const keys = await window.caches.keys();
      const deleteResults = await Promise.all(
        keys.map((key) => window.caches.delete(key))
      );
      removedCaches = deleteResults.filter(Boolean).length;
    }

    const hasControllerNow = Boolean(navigator.serviceWorker.controller);

    console.log("[dev] SW cleanup", {
      removedRegistrations,
      removedCaches,
      hadController,
      hasControllerNow,
    });
  } catch (error) {
    console.log("[dev] SW cleanup failed", error);
  }
};

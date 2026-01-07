export const unregisterServiceWorkersInDev = () => {
  if (!import.meta.env.DEV) {
    return;
  }

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      })
      .catch(() => undefined);
  }

  if (typeof window !== "undefined" && "caches" in window) {
    window.caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => window.caches.delete(key))))
      .catch(() => undefined);
  }
};

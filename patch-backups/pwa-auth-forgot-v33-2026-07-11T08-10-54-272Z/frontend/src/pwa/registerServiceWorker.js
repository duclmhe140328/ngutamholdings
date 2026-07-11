const clearOldFoodHubCaches = async () => {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith('foodhub-pwa-')).map((key) => caches.delete(key)));
};

export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return;

  // Không để service worker production cache/chặn source Vite khi chạy localhost.
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(clearOldFoodHubCaches)
      .catch(() => null);
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => registration.update())
      .catch((error) => console.warn('Không thể đăng ký service worker:', error));
  });
};

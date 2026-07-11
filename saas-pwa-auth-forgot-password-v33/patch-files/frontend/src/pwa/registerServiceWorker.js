const RELOAD_GUARD = 'ngutam_sw_reload_v33';

const clearLegacyCaches = async () => {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith('foodhub-pwa-') && key !== 'foodhub-pwa-v33')
      .map((key) => caches.delete(key))
  );
};

const activateWaitingWorker = (registration) => {
  if (registration?.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
};

export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return;

  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(clearLegacyCaches)
      .catch(() => null);
    return;
  }

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    if (sessionStorage.getItem(RELOAD_GUARD) !== '1') {
      sessionStorage.setItem(RELOAD_GUARD, '1');
      window.location.reload();
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(async (registration) => {
        await clearLegacyCaches().catch(() => null);
        await registration.update().catch(() => null);
        activateWaitingWorker(registration);

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              activateWaitingWorker(registration);
            }
          });
        });

        const update = () => registration.update().catch(() => null);
        window.addEventListener('online', update);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') update();
        });
        window.setInterval(update, 6 * 60 * 60 * 1000);
      })
      .catch((error) => console.warn('Không thể đăng ký Service Worker:', error));
  });
};

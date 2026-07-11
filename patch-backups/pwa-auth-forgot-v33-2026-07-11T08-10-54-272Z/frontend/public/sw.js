const CACHE_NAME = 'foodhub-pwa-v17-sepay-payment-rules';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => null));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match('/'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});


self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : 'Bạn có thông báo mới.' };
  }

  const title = payload.title || 'Ngự Tâm Holdings';
  const options = {
    body: payload.body || 'Bạn có thông báo mới.',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || `ngutam-${Date.now()}`,
    renotify: true,
    requireInteraction: Boolean(payload.data?.requireInteraction),
    vibrate: [220, 100, 220, 100, 320],
    data: {
      url: payload.url || '/dashboard',
      ...(payload.data || {})
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const absoluteTarget = new URL(targetUrl, self.location.origin).href;
      const existing = windowClients.find((client) => client.url === absoluteTarget || client.url.startsWith(absoluteTarget));
      if (existing) return existing.focus();
      return clients.openWindow(absoluteTarget);
    })
  );
});

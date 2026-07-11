const CACHE_NAME = 'foodhub-pwa-v33';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

const cacheSafe = async (cache, url) => {
  try { await cache.add(new Request(url, { cache: 'reload' })); } catch { /* một file lỗi không làm hỏng toàn bộ install */ }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.all(APP_SHELL.map((url) => cacheSafe(cache, url))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('foodhub-pwa-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_PWA_CACHE') {
    event.waitUntil(caches.delete(CACHE_NAME));
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || (await cache.match('/')) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname === '/manifest.webmanifest') {
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(() => caches.match(request)));
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const network = fetch(request).then(async (response) => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }).catch(() => null);

    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    return (await network) || Response.error();
  })());
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

/**
 * CROS Service Worker — Push notifications + offline caching for field workers.
 *
 * WHAT: Handles push notifications with deep linking AND caches app shell for offline access.
 * WHERE: Registered from index.html, runs in browser background.
 * WHY: Visitors and Companions doing relationship work in low-connectivity areas need offline support.
 */

const CACHE_NAME = 'cros-shell-v1';
const SHELL_ASSETS = [
  '/',
  '/manifest.json',
];

// ── Install: cache app shell ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches + claim clients ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: network-first navigation, cache-first static assets ──
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET, supabase API calls, and extensions
  if (request.method !== 'GET') return;
  if (request.url.includes('supabase.co')) return;
  if (request.url.startsWith('chrome-extension://')) return;

  // Navigation: network-first, fallback to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/').then(r => r || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // Static assets: cache-first
  if (request.url.match(/\.(js|css|png|jpg|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }
});

// ── Push Notifications ──
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    console.error('[sw] Failed to parse push data:', e);
    return;
  }

  const { title = 'CROS', body = '', deepLink = '/' } = payload;

  const options = {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'cros-notification',
    renotify: true,
    data: { deepLink },
    vibrate: [100, 50, 100],
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification Click → Deep Link ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const deepLink = event.notification.data?.deepLink || '/';
  const targetUrl = new URL(deepLink, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin)) {
          return client.focus().then((focusedClient) => {
            if (focusedClient && 'navigate' in focusedClient) {
              return focusedClient.navigate(targetUrl);
            }
            focusedClient.postMessage({ type: 'NOTIFICATION_CLICK', url: targetUrl });
            return focusedClient;
          });
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

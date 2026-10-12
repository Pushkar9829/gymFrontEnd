/*
 * Member app service worker. Registered by the member app only, with scope /portal, so the staff app
 * is never controlled by it.
 * - Caches the app's static build files (hashed, never change) and the app page for offline start.
 * - Never touches /api or other sites: personal data always comes from the network and is never stored here.
 * - Shows push notifications and opens the right app page when one is tapped.
 * Bump VERSION when this file changes; the app shows an "Update" button for the new version.
 */
const VERSION = 'v1';
const STATIC = `gym-static-${VERSION}`;
const SHELL = `gym-shell-${VERSION}`;
const SHELL_URL = '/portal';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.add(new Request(SHELL_URL, { cache: 'reload' })))
      .catch(() => undefined),
  );
});

// A new version waits until the app asks for it, so an open page never mixes old and new files.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = [STATIC, SHELL];
      for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API on its own domain, Razorpay, fonts: not ours
  if (url.pathname.startsWith('/api/')) return; // personal data: network only, never cached

  if (req.mode === 'navigate') {
    // Network first; when offline open the saved app page (it holds no personal data).
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(SHELL_URL, copy));
          }
          return res;
        })
        .catch(() => caches.match(SHELL_URL).then((hit) => hit || Response.error())),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname === '/favicon.svg') {
    // Build files have a content hash in the name: cache first.
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Gym', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data.tag,
      data: { url: data.url || '/portal' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || '/portal';
  // Only pages of the member app are opened.
  const target = new URL(path.startsWith('/portal') ? path : '/portal', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).pathname.startsWith('/portal') && 'focus' in w) {
          if ('navigate' in w) await w.navigate(target).catch(() => undefined);
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});

const CACHE = 'rml-v142';
const PRECACHE = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/brand/logos/logo-dashboard.png',
  '/brand/logos/logo-labs.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.url.includes('/api/') || req.url.includes('supabase') || req.url.includes('stripe')) {
    return;
  }
  // NETWORK-FIRST for the app shell (navigations / HTML): always load the freshest deploy when
  // online, fall back to cache only offline. This is what makes new versions show up on reload
  // instead of being stuck behind a cached index.html.
  const isHtml = req.mode === 'navigate' || (req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html'));
  if (isHtml) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(req, clone)); }
        return res;
      }).catch(() => caches.match(req).then(m => m || caches.match('/')))
    );
    return;
  }
  // CACHE-FIRST for hashed assets (immutable by filename) — fast, offline-safe.
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res.ok && req.method === 'GET') {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
      }
      return res;
    }))
  );
});

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Risk Matrix Labs', {
      body:    data.body  || 'Time to log your session.',
      icon:    '/icon-192.png',
      badge:   '/icon-192.png',
      tag:     'rml-reminder',
      renotify: true,
      data:    { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});

// MOA Service Worker: PWA offline cache + in-app update + notifications
const CACHE_NAME = 'moa-cache-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './moa-icon.png',
  './manifest.webmanifest',
  './version.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE).catch(() => {}))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-First for HTML/navigation and version.json, Cache-First for static assets
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Network-First for HTML navigation and version.json to always get the latest app
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('version.json') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for other static assets
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
      }
      return res;
    }).catch(() => cached))
  );
});

// Push notification handling
self.addEventListener('push', event => {
  let data = { title: 'MOA 용돈 관리', body: '새로운 알림이 도착했어요.', icon: './moa-icon.png', url: './index.html' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || './moa-icon.png',
      badge: './moa-icon.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || './index.html' }
    })
  );
});

// Click notification to open or focus the app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// Message listener for immediate local notification triggers
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, url } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: icon || './moa-icon.png',
      badge: './moa-icon.png',
      data: { url: url || './index.html' }
    });
  }
});

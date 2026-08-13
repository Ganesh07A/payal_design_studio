const CACHE_NAME = 'payal-studio-v1';
const ASSETS = [
  './',
  'index.html',
  'dashboard.html',
  'orders.html',
  'new-order.html',
  'bill.html',
  'catalog.html',
  'broadcast.html',
  'assets/app.js',
  'assets/db.js',
  'assets/style.css'
];

// Install — cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME)
            .map(k => caches.delete(k))
      )
    )
  );
});

// Fetch — serve from cache, fallback to network
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request))
      .catch(() => caches.match('dashboard.html'))
  );
});
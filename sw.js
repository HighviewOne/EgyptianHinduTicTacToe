/* ─────────────────────────────────────────────
   Service Worker — offline-first cache
───────────────────────────────────────────── */
const CACHE  = 'ehttt-v1';
const ASSETS = [
  '.',
  'index.html',
  'styles.css',
  'gameLogic.js',
  'data.js',
  'audio.js',
  'ai.js',
  'script.js',
  'icon.svg',
  'manifest.json',
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  ev.respondWith(
    caches.match(ev.request).then(r => r || fetch(ev.request))
  );
});

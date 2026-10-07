/* ─────────────────────────────────────────────
   Service Worker — network-first, cache fallback
   Online players always get the latest deploy;
   the cache keeps the game playable offline.
───────────────────────────────────────────── */
const CACHE  = 'ehttt-v3';
const ASSETS = [
  '.',
  'index.html',
  'styles.css',
  'gameLogic.js',
  'data.js',
  'audio.js',
  'ai.js',
  'chaos.js',
  'stats.js',
  'board.js',
  'themes.js',
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
  const req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  ev.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(r =>
        r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});

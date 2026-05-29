// Starweaver service worker — network-first, cache fallback. Bump CACHE on change.
const CACHE = 'starweaver-v21';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/main.js',
  './js/state.js',
  './js/audio.js',
  './js/icons.js',
  './js/engine/loop.js',
  './js/engine/canvas.js',
  './js/engine/input.js',
  './js/engine/pool.js',
  './js/engine/vec.js',
  './js/engine/fx.js',
  './js/game/world.js',
  './js/game/render.js',
  './js/game/content.js',
  './js/game/player.js',
  './js/game/meta.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});

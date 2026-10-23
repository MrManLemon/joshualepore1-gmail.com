// Service worker: a background script the browser runs separately from the
// page. It intercepts network requests so the app loads with no signal (gym
// basements!). Strategy: serve from cache instantly, refresh cache in the
// background ("stale-while-revalidate").
//
// Bump VERSION whenever you deploy so phones drop the old cached files.
const VERSION = 'v1';
const CACHE = `liftquest-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/config.js',
  './js/util.js',
  './js/plates.js',
  './js/program.js',
  './js/sample.js',
  './js/store.js',
  './js/ui.js',
  './js/views/today.js',
  './js/views/workout.js',
  './js/views/summary.js',
  './js/views/editor.js',
  './js/views/settings.js',
  './js/views/placeholder.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    }),
  );
});

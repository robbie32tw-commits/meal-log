/* Offline shell. The app already keeps its data in IndexedDB, so caching the
   static files is all that's needed for it to open with no network at all.
   Bump VERSION whenever a cached file changes — that's what evicts the old copy. */
const VERSION = 'v3';
const CACHE = `meal-log-${VERSION}`;
const FONTS = `meal-log-fonts-${VERSION}`;

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'ds/industry/styles.css',
  'js/app.js',
  'js/db.js',
  'js/settings.js',
  'js/util.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  /* Navigations go to the network first so a deploy shows up on the next open,
     and fall back to the cached shell when there's nothing to reach. */
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          caches.open(CACHE).then(c => c.put('index.html', res.clone()));
          return res;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  if (FONT_HOSTS.includes(url.host)) {
    e.respondWith(cacheFirst(request, FONTS));
    return;
  }

  if (url.origin === self.location.origin) e.respondWith(cacheFirst(request, CACHE));
});

function cacheFirst(request, cacheName) {
  return caches.match(request).then(hit => hit || fetch(request).then(res => {
    if (res.ok || res.type === 'opaque') {
      const copy = res.clone();
      caches.open(cacheName).then(c => c.put(request, copy));
    }
    return res;
  }));
}

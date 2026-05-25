const CACHE_NAME = 'my-books-epub-reader-v44';

const APP_SHELL = [
  './',
  './index.html?v=44',
  './manifest.json?v=44',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/logo-main.svg?v=44',
  './icons/logo-app.svg?v=44'
];

const STATIC_EXTENSIONS = [
  '.html',
  '.json',
  '.js',
  '.css',
  '.png',
  '.svg',
  '.webp',
  '.jpg',
  '.jpeg',
  '.ttf',
  '.otf'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  const isNavigate = event.request.mode === 'navigate';
  const isStatic = STATIC_EXTENSIONS.some(ext => requestUrl.pathname.endsWith(ext));

  if (!isNavigate && !isStatic) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        if (isStatic || isNavigate) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }

        return response;
      }).catch(() => {
        if (isNavigate) {
          return caches.match('./index.html?v=44') || caches.match('./index.html');
        }

        throw new Error('Network request failed');
      });
    })
  );
});

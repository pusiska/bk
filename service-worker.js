const CACHE_NAME = 'my-books-epub-reader-v524';

const APP_SHELL = [
  './',
  './index.html',
  './index.html?v=524',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/logo-main.svg',
  './icons/logo-app.svg',
  './fonts/uvkits.ttf',
  './fonts/KONSTRUKT-Regular.otf',
  './libs/jszip.min.js'
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

function getCacheKey(request) {
  const url = new URL(request.url);
  url.search = '';
  return new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
    mode: request.mode === 'navigate' ? 'same-origin' : request.mode,
    credentials: request.credentials,
    redirect: request.redirect
  });
}

async function getOfflineShell() {
  return await caches.match('./index.html?v=524') || await caches.match('./index.html') || await caches.match('./');
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL).catch(error => { console.warn('App shell cache failed:', error); return cache.addAll(['./', './index.html', './index.html?v=524', './manifest.json']); }))
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

  event.respondWith((async () => {
    const cacheKey = getCacheKey(event.request);
    const cached = await caches.match(cacheKey);

    if (cached) return cached;

    try {
      const response = await fetch(event.request);

      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }

      if (isNavigate || isStatic) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(cacheKey, response.clone());
      }

      return response;
    } catch (error) {
      if (isNavigate) {
        const offlineShell = await getOfflineShell();
        if (offlineShell) return offlineShell;
      }

      throw error;
    }
  })());
});

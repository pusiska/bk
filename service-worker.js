const CACHE_NAME = 'my-books-epub-reader-v523';

const APP_SHELL = [
  './',
  './index.html',
  './index.html?v=523',
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
  return await caches.match('./index.html?v=523') || await caches.match('./index.html') || await caches.match('./');
}

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


const SHARED_DB_NAME = 'my-books-shared-files';
const SHARED_STORE_NAME = 'files';

function openSharedDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARED_DB_NAME, 1);

    request.onupgradeneeded = event => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(SHARED_STORE_NAME)) {
        database.createObjectStore(SHARED_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSharedFiles(files) {
  const database = await openSharedDb();
  const transaction = database.transaction(SHARED_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(SHARED_STORE_NAME);

  for (const file of files) {
    if (file && /\.epub$/i.test(file.name || '')) {
      store.put({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        file,
        createdAt: new Date().toISOString()
      });
    }
  }

  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

async function handleShareTarget(request) {
  const formData = await request.formData();
  const files = formData.getAll('epubFiles');
  await saveSharedFiles(files);
  return Response.redirect('./index.html?shared=1', 303);
}


self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  if (event.request.method === 'POST' && requestUrl.pathname.endsWith('/index.html') && requestUrl.searchParams.has('share-target')) {
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  if (event.request.method !== 'GET') return;

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

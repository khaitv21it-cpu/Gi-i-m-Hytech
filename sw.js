/* Service Worker for Giải mã Hytech (PWA Offline) */
const CACHE_NAME = 'hytech-pwa-v1.0.1';

const PRECACHE_RESOURCES = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './favicon.ico',
  './favicon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
  './icons/icon.svg'
];

// 1. Install Event: Precache all essential offline assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_RESOURCES);
    }).then(() => {
      // Force activation without waiting for existing tabs to close
      return self.skipWaiting();
    })
  );
});

// 2. Activate Event: Clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      // Immediately take control of all open clients
      return self.clients.claim();
    })
  );
});

// 3. Fetch Event: Cache-First strategy for static assets, with offline navigation fallback
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle HTTP/HTTPS GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle navigate request (when user opens or reloads the web page)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cachedIndex) => {
        return (
          cachedIndex ||
          fetch(request).catch(() => {
            return caches.match('./index.html');
          })
        );
      })
    );
    return;
  }

  // Cache-First strategy for all other GET requests (icons, manifest, etc.)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        // Only cache valid responses from the same origin
        if (
          !networkResponse ||
          networkResponse.status !== 200 ||
          networkResponse.type !== 'basic'
        ) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // If offline and request is an image or icon, try fallback
        if (request.destination === 'image') {
          return caches.match('./icon-192.png');
        }
      });
    })
  );
});

// Listen for messages from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

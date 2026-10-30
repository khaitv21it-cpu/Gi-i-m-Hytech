/* Service Worker for Giải mã Hytech (PWA Offline v2.0.0) */
const CACHE_NAME = 'hytech-pwa-v2.0.0';

// Core essential assets - MUST be cached successfully
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Secondary assets (icons) - cached safely with Promise.allSettled
const SECONDARY_ASSETS = [
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
  './icons/icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon.svg',
  './favicon.ico',
  './favicon.png',
  './apple-touch-icon.png'
];

// 1. Install Event: Precache core assets immediately, secondary safely
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Precache critical HTML and Manifest
      await cache.addAll(CORE_ASSETS);
      // Cache secondary assets with allSettled so no single missing icon will EVER block PWA install
      await Promise.allSettled(SECONDARY_ASSETS.map((asset) => cache.add(asset)));
      // Force new service worker to activate immediately
      return self.skipWaiting();
    })()
  );
});

// 2. Activate Event: Clean up all older caches & take immediate control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
      // Take control of all pages without requiring a page refresh
      return self.clients.claim();
    })()
  );
});

// 3. Fetch Event: Rock-solid Offline Navigation & Cache-First Strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle HTTP/HTTPS GET
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Only handle requests from our origin
  if (url.origin !== self.location.origin) {
    return;
  }

  // Detect any HTML / Navigation request (Android Chrome, iOS Safari Standalone, WebKit, Desktop)
  const isHtmlRequest =
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));

  if (isHtmlRequest) {
    // OFFLINE-FIRST FOR NAVIGATION / COLD START
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        // 1. Check exact request in cache (ignoring search params like ?utm_source)
        let cached = await cache.match(request, { ignoreSearch: true });
        if (cached) {
          // If online, revalidate in background without blocking offline launch
          fetch(request).then((netRes) => {
            if (netRes && netRes.status === 200) {
              cache.put(request, netRes);
            }
          }).catch(() => {});
          return cached;
        }

        // 2. Try index.html from cache
        cached = await cache.match('./index.html');
        if (cached) return cached;

        // 3. Try root ./ from cache
        cached = await cache.match('./');
        if (cached) return cached;

        // 4. If somehow not in cache (first cold run), fetch from network
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          // 5. Ultimate fallback if offline: NEVER return undefined!
          const fallback = (await cache.match('./index.html')) || (await cache.match('./'));
          if (fallback) return fallback;

          return new Response(
            '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Giải mã Hytech</title></head><body>Vui lòng kết nối mạng một lần để nạp dữ liệu offline.</body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }
      })()
    );
    return;
  }

  // STATIC ASSETS (icons, manifest): Cache-First
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;

      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        // Offline icon fallback
        if (
          request.destination === 'image' ||
          url.pathname.endsWith('.png') ||
          url.pathname.endsWith('.svg') ||
          url.pathname.endsWith('.ico')
        ) {
          const iconFallback =
            (await cache.match('./icons/icon-192.png')) ||
            (await cache.match('./icon-192.png')) ||
            (await cache.match('./icons/favicon.png'));
          if (iconFallback) return iconFallback;
        }
      }
    })()
  );
});

// Listen for messages from client (e.g. skipWaiting trigger)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

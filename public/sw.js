const CACHE_NAME = 'zyphra-static-v2';
const CORE_ASSETS = [
  '/public/css/app.css?v=6.0.0-production-hardening',
  '/public/css/core.css?v=6.0.0-production-hardening',
  '/public/css/clean-ui.css?v=6.0.0-production-hardening',
  '/public/css/responsive.css?v=6.0.0-production-hardening',
  '/public/css/storefront.css?v=6.0.0-production-hardening',
  '/public/css/feature-pack.css?v=1.1.0-production-hardening',
  '/public/css/accessibility.css?v=1.0.0',
  '/public/js/app.js?v=6.0.0-production-hardening',
  '/public/icons/icon-192.svg',
  '/public/icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => null));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/public/')) return;
  if (!['style', 'script', 'image', 'font', 'manifest'].includes(request.destination) && !url.pathname.endsWith('.webmanifest')) return;

  event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
    const cached = await cache.match(request);
    const network = fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') cache.put(request, response.clone()).catch(() => {});
      return response;
    });
    return cached || network;
  }));
});

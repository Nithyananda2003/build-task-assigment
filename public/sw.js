const CACHE = 'daily-spark-shell-v1';
const SHELL = ['/', '/style.css', '/app.js', '/icon.svg', '/manifest.webmanifest'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('daily-spark-shell-') && k !== CACHE).map(k => caches.delete(k))))); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Never cache balances, answers or API responses. Offline points are never invented.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (!SHELL.includes(url.pathname)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
    return response;
  }).catch(() => caches.match(event.request).then(response => response || Response.error())));
});

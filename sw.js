// Service worker: guarda la app en el iPhone para que funcione sin conexión.
const V = 'gym-v3';
const FILES = ['./', './index.html', './app.js', './data.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(res => {
    if (res.ok && new URL(e.request.url).origin === location.origin) { const c = res.clone(); caches.open(V).then(x => x.put(e.request, c)); }
    return res;
  }).catch(() => caches.match('./index.html'))));
});

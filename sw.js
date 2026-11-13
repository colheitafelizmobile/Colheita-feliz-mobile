// Colheita Feliz - Service Worker
// Mude VERSION quando quiser forçar a limpeza total do cache antigo.
const VERSION = '2026-11-12-1';
const CACHE = 'colheita-feliz-' + VERSION;
const PRECACHE = ['./', 'index.html', 'manifest.json', 'apple-touch-icon.png'];
const NETWORK_TIMEOUT = 8000; // ms esperando a rede antes de usar o cache

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(PRECACHE.map((url) =>
        fetch(url, { cache: 'reload' }).then((res) => {
          if (res.ok) return cache.put(url, res);
        })
      ))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isPage(request, url) {
  return request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html');
}

// Rede primeiro (sempre revalida com o servidor), cache só se estiver offline/lento
function networkFirst(event) {
  const request = event.request;
  const key = new URL(request.url).pathname.endsWith('/') || request.mode === 'navigate' ? 'index.html' : request;
  const fromNetwork = fetch(request, { cache: 'no-cache' }).then((res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(key, copy));
    }
    return res;
  });
  event.waitUntil(fromNetwork.catch(() => {}));
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT, null));
  return Promise.race([fromNetwork, timeout])
    .then((res) => res || caches.match(key, { ignoreSearch: true }).then((c) => c || fromNetwork))
    .catch(() => caches.match(key, { ignoreSearch: true }));
}

// Outros arquivos (manifest, ícones): usa cache e atualiza em segundo plano
function staleWhileRevalidate(event) {
  const request = event.request;
  return caches.match(request).then((cached) => {
    const fresh = fetch(request, { cache: 'no-cache' }).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    });
    event.waitUntil(fresh.catch(() => {}));
    return cached || fresh;
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;
  event.respondWith(isPage(request, url) ? networkFirst(event) : staleWhileRevalidate(event));
});

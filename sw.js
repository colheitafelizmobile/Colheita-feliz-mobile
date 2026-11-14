// Service worker - Colheita Feliz
// Estratégia: sempre tenta a rede primeiro (para receber atualizações do GitHub Pages)
// e usa o cache como reserva quando estiver offline.

const CACHE_NAME = 'colheita-feliz-v3';

// Arquivos que serão guardados no cache na instalação.
// Caminhos relativos para funcionar em qualquer pasta do GitHub Pages.
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Cada arquivo é adicionado separadamente: se um faltar, os outros continuam sendo guardados.
      Promise.all(ASSETS.map((url) => cache.add(url).catch(() => {})))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só trata requisições GET do próprio site (ignora APIs e domínios externos).
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(req);
        if (networkResponse && networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        // Sem internet: tenta o cache.
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;

        // Navegação sem cache específico: devolve a página principal.
        if (req.mode === 'navigate') {
          const index = await caches.match('./index.html');
          if (index) return index;
        }
        return Response.error();
      }
    })()
  );
});

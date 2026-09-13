// Service worker mínimo: cachea solo el "shell" estático de la app (HTML/CSS/JS/iconos)
// para que cargue al instante y funcione sin conexión en visitas repetidas. Los tiempos de
// paso de /api/emt-arrives y /api/emt-stop-detail son datos en vivo — cachearlos por error
// haría que la app mostrara tiempos de bus caducados sin avisar, así que solo se interceptan
// las rutas exactas de SHELL_FILES; todo lo demás (esas dos rutas, fuentes de Google, etc.)
// pasa de largo sin tocar la caché.
const CACHE_NAME = 'busya-v1';
const SHELL_FILES = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!SHELL_FILES.includes(url.pathname)) return;

  // Stale-while-revalidate: sirve la copia cacheada al instante (rápido, funciona offline)
  // pero siempre pide también una fresca en segundo plano y actualiza la caché para la
  // próxima vez. Con cache-first a secas, un cambio en index.html/style.css/app.js solo se
  // notaría cuando también cambiaran los bytes de este propio sw.js (lo único que hace que
  // el navegador se entere de que hay una versión nueva del service worker) — así basta con
  // tocar el shell, sin acordarse de subir CACHE_NAME salvo que cambie SHELL_FILES.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const network = fetch(event.request.url, { cache: 'reload' })
          .then(async (response) => {
            await cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cached);
        event.waitUntil(network);
        return cached || network;
      })
    )
  );
});

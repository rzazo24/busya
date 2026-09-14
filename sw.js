// Service worker mínimo: cachea solo el "shell" estático de la app (HTML/CSS/JS/iconos)
// para que cargue al instante y funcione sin conexión en visitas repetidas. Los tiempos de
// paso de /api/emt-arrives y /api/emt-stop-detail son datos en vivo — cachearlos por error
// haría que la app mostrara tiempos de bus caducados sin avisar, así que solo se interceptan
// las rutas exactas de SHELL_FILES; todo lo demás (esas dos rutas, fuentes de Google, etc.)
// pasa de largo sin tocar la caché.
// Va a juego con el número de versión visible en el pie de página (index.html) y con
// "version" en package.json — los tres se suben juntos en cada despliegue con cambios
// visibles (antes esto era un contador suelto sin relación con nada, tipo "busya-v10").
// Subir este número es lo que avisa a quien ya tiene la app abierta/instalada de que hay una
// versión nueva (ver el aviso "Recargar" en app.js, que depende de que este propio archivo
// cambie de bytes — es lo único que hace que el navegador note una versión nueva del service
// worker). El stale-while-revalidate de abajo ya refresca solo el contenido de SHELL_FILES en
// segundo plano sin necesidad de subir esto, pero entonces nadie se entera del cambio hasta
// la siguiente vez que abra la app de cero: subir la versión aquí en cada despliegue con
// cambios visibles es lo que hace que salga el aviso.
const CACHE_NAME = 'busya-v1.3.5';
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
  // próxima vez. Esto por sí solo ya mantiene el contenido al día sin subir CACHE_NAME —
  // pero en silencio, sin avisar a quien ya tenía la app abierta hasta que la cierre y la
  // abra de cero. Para que salga el aviso de "versión nueva" (ver arriba) hay que subir
  // CACHE_NAME.
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

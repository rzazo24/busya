# Changelog

Historial de versiones de BusYa, de la más reciente a la más antigua. Sigue el espíritu de
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/): cada versión agrupada en
Añadido/Corregido. A partir de la v1.0.0 cada versión corresponde a un commit propio de
`package.json` (enlazado por su hash); antes de eso el proyecto no llevaba un número de
versión con significado, así que la v0.1.0 agrupa por tema todo el desarrollo inicial.

## Sin versionar (solo backend)

Cambios en las funciones serverless (`api/*.js`) que no suben el número de versión ni el
`CACHE_NAME` del service worker — no tocan el shell estático que este cachea (html/css/js),
así que no hay nada que anuncie una "versión nueva"; el fix ya está en producción para todo el
mundo desde el momento del despliegue en Vercel, igual que cualquier otro cambio de backend.

### Corregido

- CRTM: la distancia del bus se repetía igual en todas las llegadas de una misma línea+
  sentido aunque fueran horas después (la posición en vivo de `GetLineLocation.php` es del
  vehículo en servicio ahora, no una por cada hora programada); ahora solo se calcula para la
  llegada más próxima de cada línea+sentido, el resto se queda sin distancia. ([24483a7])
- CRTM: esa distancia podía ser físicamente imposible para la llegada más próxima cuando hay
  varios vehículos circulando en la misma línea+sentido (confirmado en vivo: un bus "llegando"
  en 14s mostrando ~3 km, lo que exigiría 216 m/s). Ahora se elige el vehículo más cercano de
  los que haya, y aun así se descarta la distancia si implica una velocidad media imposible
  para un autobús. ([5d9c4d7])

## [1.5.4] - 2026-09-16

### Corregido

- Los minutos de llegada se truncan hacia abajo en vez de redondearse, para no mostrar un
  minuto más que otras apps (EMT oficial, Google Maps) durante la segunda mitad de cada
  minuto. ([2bce0f2])

## [1.5.3] - 2026-09-16

### Corregido

- Las paradas EMT reales pero deshabilitadas para el tiempo real (p. ej. la parada 51159)
  muestran su horario/frecuencia programada en vez de un error de "parada no encontrada".
  ([115da70])

## [1.5.2] - 2026-09-15

### Corregido

- Las barras de scroll en escritorio usan los colores del tema de la app en vez del gris por
  defecto del sistema. ([a0ecfcc])

## [1.5.1] - 2026-09-15

### Corregido

- Footer un poco más grande en móvil (7px → 9px). ([2e3cc68])

## [1.5.0] - 2026-09-15

### Añadido

- Tema claro opcional (selector Oscuro/Claro/Automático en la ayuda); el oscuro sigue siendo
  el que se ve por defecto. ([0db12b9])

## [1.4.2] - 2026-09-15

### Corregido

- El anillo de foco azul de los botones ✕ seguía apareciendo tras un toque en iOS; sustituido
  el `:focus-visible` nativo por una detección manual de teclado. ([eac4129])

## [1.4.1] - 2026-09-15

### Añadido

- Exportar/importar favoritos (paradas y líneas) como archivo JSON, con fusión no destructiva
  al importar. ([cb4ff35])

## [1.4.0] - 2026-09-15

### Añadido

- Selector para forzar las animaciones activadas o desactivadas, sin depender de la
  preferencia del sistema. ([6d17daa])

## [1.3.14] - 2026-09-15

### Añadido

- Las 3 animaciones infinitas de la app respetan `prefers-reduced-motion` por defecto.
  ([3d85f62])

## [1.3.13] - 2026-09-15

### Corregido

- Agrandados los glifos "i" y "?" de los iconos de ayuda/estado de las APIs. ([b6d8e81])

## [1.3.12] - 2026-09-15

### Corregido

- Quitado el círculo interior duplicado de los iconos de ayuda y estado de las APIs.
  ([2e5513b])

## [1.3.11] - 2026-09-15

### Corregido

- El aria-label del botón de favorito no se actualizaba al marcar/desmarcar una parada. El
  service worker podía cachear como válida una respuesta de red fallida. ([2e6110d])

## [1.3.10] - 2026-09-15

### Corregido

- Mensaje "[object Object]" al buscar una parada que EMT no reconoce, sustituido por un
  mensaje legible. ([ea73551])

## [1.3.9] - 2026-09-15

### Corregido

- Anillo de foco azul intermitente en los botones ✕ al abrir un panel. ([57dc762])

## [1.3.8] - 2026-09-15

### Corregido

- Botones que se quedaban "iluminados" en móvil por el tap-highlight de WebKit/Android.
  ([2a80143])

## [1.3.7] - 2026-09-15

### Corregido

- Reutilizada la animación de puntos de carga en la vista previa de cada favorito.
  ([22ba618])

## [1.3.6] - 2026-09-15

### Añadido

- Login "Protected" de EMT (X-ClientId/passKey) en vez de email/contraseña — más cuota
  (250k peticiones/día) y sesiones de hasta 24h. ([3966a7d])

### Corregido

- Animación de puntos en vez del texto "Comprobando…" en el panel de Estado de las APIs, que
  se salía del recuadro en móvil. ([7c67bba])

## [1.3.5] - 2026-09-15

### Corregido

- CRTM también se nombra en el título de la página y la meta description. ([d5b7250])

## [1.3.4] - 2026-09-15

### Corregido

- CRTM también se nombra en el pie de página. ([12caf0a])

## [1.3.3] - 2026-09-15

### Añadido

- Sustituidos todos los iconos de texto/emoji por un set propio en SVG. ([1538ea4])

## [1.3.2] - 2026-09-15

### Corregido

- Icono de compartir descentrado en móvil. ([bde3a6d])

## [1.3.1] - 2026-09-14

### Corregido

- Icono de compartir en SVG en vez de una flecha de texto. ([12142a2])

## [1.3.0] - 2026-09-14

### Añadido

- Compartir una parada con el share sheet nativo (o copiar el enlace si el navegador no lo
  tiene). ([df9ad05])

### Corregido

- Más margen de tiempo para la llamada esencial de CRTM (tiempos de paso), que a veces se
  descartaba como fallo pese a responder bien poco después. ([ab939cd])

## [1.2.0] - 2026-09-14

### Añadido

- Vista previa de los próximos tiempos de paso en cada tarjeta de favoritos. ([dd78182])

## [1.1.1] - 2026-09-14

### Corregido

- Cambiado el icono del panel de estado, no pegaba con el diseño. ([497e41d])

## [1.1.0] - 2026-09-14

### Añadido

- Panel de "Estado de las APIs", con los tiempos de respuesta en directo de EMT, CRTM y
  paradas cercanas. ([1a4a4c1])

## [1.0.0] - 2026-09-14

### Añadido

- Primer número de versión real de la app, visible en el pie de página y usado para
  invalidar la caché del service worker cuando hay una actualización. ([ffdca08])

## [0.1.0] - 2026-09-13 a 2026-09-14

Desarrollo inicial del proyecto, antes de llevar un número de versión con significado —
resumido aquí por tema en vez de commit por commit.

### Añadido

- Primera versión funcional: proxy serverless a la API de EMT Madrid, buscador de parada y
  lista de tiempos de paso en vivo.
- Buses interurbanos de la Comunidad de Madrid vía la API de CRTM, con colores reales por red
  (azul EMT / verde interurbano) y distancia aproximada del bus.
- Favoritos de parada (`localStorage`): guardarlas, panel propio con tarjetas editables y
  reordenables, insignia de red.
- Favoritos de línea: marcar una línea concreta para que se resalte y suba al principio de la
  lista, con un tope de 3 llegadas promovidas por línea.
- Enlace directo a una parada (`?stop=&network=`) y búsqueda de paradas cercanas por
  geolocalización.
- Hora de paso (HH:MM) en vez de una cuenta atrás larga a partir de 45 min de espera; horario
  y frecuencia programada cuando no hay tiempo real fiable.
- Estado "sin conexión" que conserva los últimos tiempos en pantalla en vez de borrarlos.
- BusYa instalable como PWA, con aviso manual ("Recargar") cuando hay una versión nueva en vez
  de recargar sola.
- Accesibilidad por teclado en los overlays de ayuda/favoritos; panel de ayuda con enlace al
  repositorio de GitHub.
- Vercel Web Analytics.
- Smoke test de extremo a extremo con Playwright (`npm test`).

### Corregido

- ETAs absurdas en líneas nocturnas sin GPS en tiempo real.
- "Parada no encontrada" en EMT cuando la parada sí existía; nombre real de la parada visible
  aunque falle `/arrives/`; "No estimations found" tratado como "sin buses ahora", no como
  error.
- Una búsqueda antigua que tardaba más ya no podía pisar en pantalla los resultados de una
  búsqueda más reciente.
- Varios ajustes de diseño responsive: tamaño de fuente, footer, topbar, zoom automático de
  iOS/Android al enfocar el buscador, scroll de fondo bloqueado con un overlay abierto, salto
  del panel al refrescar.

[2bce0f2]: https://github.com/rzazo24/busya/commit/2bce0f2719e6d47330b05fbdd55a505ef898ab87
[115da70]: https://github.com/rzazo24/busya/commit/115da7019b710cdb55690af3f93f9da588dbd3d5
[a0ecfcc]: https://github.com/rzazo24/busya/commit/a0ecfccee03b8b2c3fa8acbcec61502bd1d451df
[2e3cc68]: https://github.com/rzazo24/busya/commit/2e3cc6868f46d818615e70162e203b260daf864a
[0db12b9]: https://github.com/rzazo24/busya/commit/0db12b90c3fd0ed880380900159eb90851b663d3
[eac4129]: https://github.com/rzazo24/busya/commit/eac412905a3a4e5abcc0414cae93b0ecd06d3344
[cb4ff35]: https://github.com/rzazo24/busya/commit/cb4ff35aca95d17ba3f535e8e4f3bdf0b5aef071
[6d17daa]: https://github.com/rzazo24/busya/commit/6d17daaad7ebf16c13905c174043bcc9e1bdfaeb
[3d85f62]: https://github.com/rzazo24/busya/commit/3d85f62e7e32ec5eecf4375d707a0c3b2388f90f
[b6d8e81]: https://github.com/rzazo24/busya/commit/b6d8e8137673a56b648ecc1edc204ecc9134699d
[2e5513b]: https://github.com/rzazo24/busya/commit/2e5513bba1aef1e1d185cf70f87e8c5e71666549
[2e6110d]: https://github.com/rzazo24/busya/commit/2e6110d3e72c6788fa79b1cc98543d45d4d830f8
[ea73551]: https://github.com/rzazo24/busya/commit/ea73551ca89d1d3fbe440c67b3c71ec6780a2c70
[57dc762]: https://github.com/rzazo24/busya/commit/57dc76252814da46d89a41ac4107354aca7b8450
[2a80143]: https://github.com/rzazo24/busya/commit/2a80143c874d53b3d58f8609b5add85a57649e17
[22ba618]: https://github.com/rzazo24/busya/commit/22ba618d56b0309c44a49434b20bac85f4c6186d
[3966a7d]: https://github.com/rzazo24/busya/commit/3966a7d2d8a67b62b6e27e0c16a251d44a924ad9
[24483a7]: https://github.com/rzazo24/busya/commit/24483a72023a4a1421cf7af423576e887fe82ab0
[5d9c4d7]: https://github.com/rzazo24/busya/commit/5d9c4d7e6e5d99ee90cf47f03879d04131d941e6
[7c67bba]: https://github.com/rzazo24/busya/commit/7c67bba2116bbfd8ba60187734a3998a032a1fa6
[d5b7250]: https://github.com/rzazo24/busya/commit/d5b7250829131d29023e4ff6dd3efd33e50edd71
[12caf0a]: https://github.com/rzazo24/busya/commit/12caf0ac7e122564490a2d3edc3ec4688af040b2
[1538ea4]: https://github.com/rzazo24/busya/commit/1538ea48859d74aaec0e8cc0893413a7732d10c3
[bde3a6d]: https://github.com/rzazo24/busya/commit/bde3a6d7f7290a5808a11534876a09e621294f4a
[12142a2]: https://github.com/rzazo24/busya/commit/12142a2819b6c7ea8457e489a004a41102c5cf2a
[df9ad05]: https://github.com/rzazo24/busya/commit/df9ad0562a53bf3fadbbdb356a3d62a998d33578
[ab939cd]: https://github.com/rzazo24/busya/commit/ab939cdcd48ba2e07f1bc06ca261ad05efc911c2
[dd78182]: https://github.com/rzazo24/busya/commit/dd781825e6eebb9b71a1b81de5d4c11d0263dede
[497e41d]: https://github.com/rzazo24/busya/commit/497e41db4afa4c02bd780ebb747c5c80d9dae3e4
[1a4a4c1]: https://github.com/rzazo24/busya/commit/1a4a4c1d31b115ace9a386bdc9a3c2d540831f98
[ffdca08]: https://github.com/rzazo24/busya/commit/ffdca08478828f437903e94b78d090c8576093b0

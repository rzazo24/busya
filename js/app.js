const REFRESH_INTERVAL_MS = 30_000;
const LAST_STOP_STORAGE_KEY = 'busya:lastStopId';
const LAST_NETWORK_STORAGE_KEY = 'busya:lastNetwork';
const FAVORITES_STORAGE_KEY = 'busya:favorites';
const FAVORITE_LINES_STORAGE_KEY = 'busya:favoriteLines';
const MOTION_PREFERENCE_KEY = 'busya:motionPreference';
const THEME_PREFERENCE_KEY = 'busya:themePreference';
const NETWORK_LABELS = { emt: 'EMT', crtm: 'Interurbano' };
// Solo para el badge de red en las tarjetas de favoritos: ahí "CRTM" es más compacto que
// "Interurbano" y ya lo reconoce quien mira esa lista. El toggle del buscador y los mensajes
// de error siguen diciendo "Interurbano", más claro para quien no sepa qué es CRTM.
const FAVORITE_NETWORK_LABELS = { emt: 'EMT', crtm: 'CRTM' };

// Iconos SVG (trazo, sin relleno salvo donde se indica) en vez de los caracteres Unicode que
// había antes: un emoji de color desentona con el resto (ya pasó con 📶) y un simple
// carácter no da tanto control de forma/grosor como un SVG propio, sobre todo en móvil.
// Centralizados aquí en vez de repetidos en el HTML y en las tarjetas de favorito (creadas
// desde JS) para que no haya dos copias del mismo icono que puedan desincronizarse.
const ICON_HEART =
  '<svg viewBox="0 0 24 24" fill="none" class="icon-heart" aria-hidden="true"><path d="M12 20.2s-7.5-4.5-9.8-9.1C.6 7.9 2 4.3 5.4 3.4c2.1-.6 4.3.3 5.6 2.1a1 1 0 0 0 1.6 0c1.3-1.8 3.5-2.7 5.6-2.1 3.4.9 4.8 4.5 3.2 7.7-2.3 4.6-9.8 9.1-9.8 9.1z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
// El círculo grande de estos dos (help/info) se quitó a propósito: el propio .help-btn ya
// dibuja su círculo (border-radius:50% + border), así que el SVG lo duplicaba justo por
// dentro del borde del botón, dando un efecto de "círculo dentro de otro círculo" — se deja
// solo el glifo (? / i), que ya queda centrado y enmarcado por el círculo del botón. El
// <g transform="scale(...)"> agranda el glifo un poco respecto al tamaño original (pensado
// para caber dentro del círculo que ya no está) sin tener que retocar a mano cada coordenada.
const ICON_HELP =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><g transform="translate(12 12) scale(1.35) translate(-12 -12)"><path d="M9.4 9.6c0-1.9 1.6-3.3 2.7-3.3 2 0 3.4 1.4 3.4 3.1 0 1.3-.7 2.1-1.8 2.8-.9.6-1.3 1-1.3 2v.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12.1" cy="16.9" r="1.05" fill="currentColor"/></g></svg>';
const ICON_INFO =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><g transform="translate(12 12) scale(1.35) translate(-12 -12)"><circle cx="12" cy="7.8" r="1.05" fill="currentColor"/><path d="M12 11v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></g></svg>';
const ICON_CLOSE =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const ICON_REFRESH =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.6 12a7.4 7.4 0 0 1 12.6-5.3M19.4 12a7.4 7.4 0 0 1-12.6 5.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M17.2 3.9v3.4h-3.4M6.8 20.1v-3.4h3.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_LOCATION =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s-7-6.5-7-11.8C5 5.2 8.1 2.5 12 2.5s7 2.7 7 6.7C19 14.5 12 21 12 21z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="9.3" r="2.5" stroke="currentColor" stroke-width="1.6"/></svg>';
const ICON_ARROW_UP =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 19V5M6 10.5 12 5l6 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_ARROW_DOWN =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M6 13.5 12 19l6-5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_SHARE =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="18" cy="6" r="2.3" stroke="currentColor" stroke-width="1.6"/><circle cx="6" cy="12" r="2.3" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="18" r="2.3" stroke="currentColor" stroke-width="1.6"/><path d="M8 10.8 16 6.9M8 13.2l8 3.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

const form = document.getElementById('stop-form');
const stopInput = document.getElementById('stop-id');
const searchBtn = document.getElementById('search-btn');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const stopNameEl = document.getElementById('stop-name');
const lastUpdatedEl = document.getElementById('last-updated');
const arrivalsListEl = document.getElementById('arrivals-list');
const refreshBtn = document.getElementById('refresh-btn');
const favoriteBtn = document.getElementById('favorite-btn');
const shareBtn = document.getElementById('share-btn');
const helpOpenBtn = document.getElementById('help-open');
const helpCloseBtn = document.getElementById('help-close');
const helpOverlay = document.getElementById('help-overlay');
const helpPanel = helpOverlay.querySelector('.help-panel');
const favoritesOpenBtn = document.getElementById('favorites-open');
const favoritesCloseBtn = document.getElementById('favorites-close');
const favoritesOverlay = document.getElementById('favorites-overlay');
const favoritesPanel = favoritesOverlay.querySelector('.favorites-modal');
const favoritesManageListEl = document.getElementById('favorites-manage-list');
const favoritesEmptyEl = document.getElementById('favorites-empty');
const favoritesExportBtn = document.getElementById('favorites-export');
const favoritesImportBtn = document.getElementById('favorites-import');
const favoritesImportInput = document.getElementById('favorites-import-input');
const apiStatusOpenBtn = document.getElementById('api-status-open');
const apiStatusCloseBtn = document.getElementById('api-status-close');
const apiStatusOverlay = document.getElementById('api-status-overlay');
const apiStatusPanel = apiStatusOverlay.querySelector('.api-status-panel');
const apiStatusListEl = document.getElementById('api-status-list');
const apiStatusRecheckBtn = document.getElementById('api-status-recheck');
const networkToggleBtns = document.querySelectorAll('.network-toggle__btn');
const updateBanner = document.getElementById('update-banner');
const updateReloadBtn = document.getElementById('update-reload-btn');
const nearbyBtn = document.getElementById('nearby-btn');
const nearbyBtnIconEl = document.getElementById('nearby-btn-icon');
const nearbyResultsEl = document.getElementById('nearby-results');
const nearbyCloseBtn = document.getElementById('nearby-close');
const nearbyListEl = document.getElementById('nearby-list');
const motionPrefSelect = document.getElementById('motion-pref');
const themePrefSelect = document.getElementById('theme-pref');

// Los botones estáticos empiezan vacíos en el HTML — se rellenan aquí, una sola vez, en vez
// de repetir el marcado del SVG también en el HTML (ver comentario de los ICON_* de arriba).
favoritesOpenBtn.innerHTML = ICON_HEART;
apiStatusOpenBtn.innerHTML = ICON_INFO;
helpOpenBtn.innerHTML = ICON_HELP;
helpCloseBtn.innerHTML = ICON_CLOSE;
favoritesCloseBtn.innerHTML = ICON_CLOSE;
apiStatusCloseBtn.innerHTML = ICON_CLOSE;
nearbyCloseBtn.innerHTML = ICON_CLOSE;
refreshBtn.innerHTML = ICON_REFRESH;
shareBtn.innerHTML = ICON_SHARE;
nearbyBtnIconEl.innerHTML = ICON_LOCATION;
// favoriteBtn (♡/♥ según esté guardada o no) se rellena en updateFavoriteBtn(), no aquí.

// Preferencia de animaciones (punto del logo, "Llegando" parpadeando, puntos de carga): por
// defecto sigue el "reducir movimiento" del sistema (ver @media (prefers-reduced-motion) en
// el CSS), pero se puede forzar activada o desactivada aparte desde aquí, sin tener que tocar
// ajustes del sistema. El atributo data-motion en <html> es lo que decide en el CSS: "on"
// fuerza las animaciones incluso con el sistema en modo reducido, "off" las quita siempre
// (fuera de la media query, para que gane sin importar lo que diga el sistema), y "auto" dejar
// que decida solo prefers-reduced-motion.
function applyMotionPreference(pref) {
  document.documentElement.setAttribute('data-motion', pref);
}

function getMotionPreference() {
  return localStorage.getItem(MOTION_PREFERENCE_KEY) || 'auto';
}

const initialMotionPref = getMotionPreference();
motionPrefSelect.value = initialMotionPref;
applyMotionPreference(initialMotionPref);

motionPrefSelect.addEventListener('change', () => {
  const pref = motionPrefSelect.value;
  localStorage.setItem(MOTION_PREFERENCE_KEY, pref);
  applyMotionPreference(pref);
});

// Tema: mismo patrón que la preferencia de animaciones de arriba, pero el valor guardado por
// defecto es "dark" en vez de "auto" — el oscuro es la identidad visual de BusYa desde el
// principio, así que quien no toque el selector nunca ve la app cambiar de aspecto por sí
// sola según el sistema. [data-theme] en <html> es lo que decide la paleta en el CSS (ver
// :root/[data-theme="light"]/@media(prefers-color-scheme) en style.css); el <meta
// name="theme-color"> (color de la barra del navegador/PWA) se actualiza aquí a mano porque
// no hay forma de enlazarlo directamente a una custom property CSS.
const THEME_COLORS = { dark: '#0a0f0a', light: '#eef2ea' };
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

function applyThemePreference(pref) {
  document.documentElement.setAttribute('data-theme', pref);
  const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const effective = pref === 'light' || (pref === 'auto' && systemPrefersLight) ? 'light' : 'dark';
  if (themeColorMeta) themeColorMeta.setAttribute('content', THEME_COLORS[effective]);
}

function getThemePreference() {
  return localStorage.getItem(THEME_PREFERENCE_KEY) || 'dark';
}

const initialThemePref = getThemePreference();
themePrefSelect.value = initialThemePref;
applyThemePreference(initialThemePref);

themePrefSelect.addEventListener('change', () => {
  const pref = themePrefSelect.value;
  localStorage.setItem(THEME_PREFERENCE_KEY, pref);
  applyThemePreference(pref);
});

// Si el sistema cambia de claro a oscuro (o al revés) con la app ya abierta y la preferencia
// en "auto", el CSS ya reacciona solo (es una media query), pero el <meta name="theme-color">
// no — sin esto se quedaría con el color del tema anterior hasta la próxima recarga.
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (getThemePreference() === 'auto') applyThemePreference('auto');
});

let refreshTimer = null;
let currentStopId = null;
let currentStopName = null;
let currentNetwork = 'emt';

// Horario/frecuencia por línea de la última parada consultada (fallback cuando no hay
// tiempo real fiable). A diferencia de los tiempos de paso, esto casi no cambia, así que
// se pide una sola vez por parada, no en cada refresco de 30s.
let stopSchedule = null; // Map<línea, {startTime, stopTime, minFreq, maxFreq}>
let stopScheduleStopId = null;
let stopScheduleName = null; // Nombre real de la parada, por si /arrives/ no lo da (ver renderArrivals)

// Últimas llegadas ya normalizadas de la parada actual, para poder reordenar/resaltar al
// marcar una línea como favorita sin volver a pedir datos a la API.
let lastArrivals = [];

// Parada+red que hay realmente pintada en pantalla ahora mismo (a diferencia de
// currentStopId/currentNetwork, que ya apuntan a la búsqueda en curso desde antes de que
// responda) y cuándo se pintó, para poder distinguir "esta parada ya tenía datos buenos, no
// los borres por un fallo puntual" de "esto que se ve en pantalla es de otra parada distinta,
// ya no vale" — ver fetchArrivals.
let renderedStopId = null;
let renderedNetwork = null;
let lastSuccessAt = null;

networkToggleBtns.forEach((btn) => {
  // resetResults: solo al pulsar el selector a mano, nunca en las llamadas internas a
  // setNetwork (arranque, searchStop) — ver la propia función.
  btn.addEventListener('click', () => setNetwork(btn.dataset.network, { resetResults: true }));
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const stopId = stopInput.value.trim();
  if (!stopId) return;
  searchStop(stopId, currentNetwork);
});

refreshBtn.addEventListener('click', () => {
  if (currentStopId) fetchArrivals(currentStopId, currentNetwork, true);
});

favoriteBtn.addEventListener('click', () => {
  if (!currentStopId) return;
  toggleFavorite(currentStopId, currentNetwork, currentStopName);
  updateFavoriteBtn();
});

// La URL ya lleva siempre la parada actual (ver updateUrlForStop), así que compartir es
// simplemente compartir la página tal cual. Con Web Share API (móvil, algunos navegadores de
// escritorio) se abre el diálogo nativo; sin ella, se copia el enlace y se confirma un
// momento en el propio botón en vez de con el status de búsqueda, que es para otra cosa.
shareBtn.addEventListener('click', async () => {
  if (!currentStopId) return;

  const stopLabel = currentStopName || `la parada ${currentStopId}`;
  const shareData = {
    title: `BusYa · ${currentStopName || `Parada ${currentStopId}`}`,
    text: `Tiempos de paso de ${stopLabel} en BusYa`,
    url: window.location.href,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch {
      // AbortError si se cierra el diálogo nativo sin elegir nada — no es un fallo.
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(shareData.url);
    // El botón lleva un SVG (icono de compartir), no texto — hay que guardar/restaurar todo
    // el markup con innerHTML, textContent lo dejaría vacío al no haber ningún nodo de texto.
    const originalHTML = shareBtn.innerHTML;
    shareBtn.textContent = '✓';
    setTimeout(() => {
      shareBtn.innerHTML = originalHTML;
    }, 1500);
  } catch {
    // Sin Web Share API ni portapapeles (contexto no seguro, permiso denegado…): no queda
    // nada más que se pueda hacer aquí sin pedir que se copie la URL a mano.
  }
});

// En táctil (sobre todo iOS/PWA), un overlay position:fixed no basta para impedir que un
// gesto de scroll se "cuele" y mueva la página de detrás en vez del contenido del modal —
// justo lo reportado: el fondo se desplaza en vez de las tarjetas de favoritos. Se fija el
// body en su sitio mientras haya algún overlay abierto, y se restaura el scroll exacto al
// cerrar. Contador en vez de un booleano por si algún día hay más de un overlay a la vez.
let lockedScrollY = 0;
let openOverlayCount = 0;

function lockBodyScroll() {
  if (openOverlayCount === 0) {
    lockedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.width = '100%';
  }
  openOverlayCount++;
}

function unlockBodyScroll() {
  openOverlayCount = Math.max(0, openOverlayCount - 1);
  if (openOverlayCount === 0) {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, lockedScrollY);
  }
}

// Accesibilidad de los overlays: al abrir, se recuerda qué tenía el foco para devolvérselo al
// cerrar (si no, tras ocultar el panel el foco cae al <body> y quien navega con teclado o
// lector de pantalla pierde el sitio) y se mueve el foco al botón ✕ del propio panel; mientras
// esté abierto, el listener de "Tab" de más abajo atrapa el foco dentro de sus elementos
// enfocables para no poder tabular hasta el contenido de detrás (oculto, pero seguiría en el
// árbol de accesibilidad sin esto).
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
let lastFocusedBeforeOverlay = null;

function trapFocusInPanel(event, panel) {
  const focusable = [...panel.querySelectorAll(FOCUSABLE_SELECTOR)].filter((el) => el.offsetParent !== null);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function restoreFocusAfterOverlay() {
  if (lastFocusedBeforeOverlay && document.contains(lastFocusedBeforeOverlay)) {
    lastFocusedBeforeOverlay.focus();
  }
  lastFocusedBeforeOverlay = null;
}

// Helper genérico para los tres overlays (ayuda, favoritos, estado de las APIs): mismo abrir
// (guardar foco, mostrar, bloquear scroll, enfocar el ✕) y cerrar (ocultar, desbloquear
// scroll, devolver el foco) para los tres, en vez de repetirlo tal cual por cada uno.
function openOverlay(overlay, closeBtn) {
  lastFocusedBeforeOverlay = document.activeElement;
  overlay.hidden = false;
  lockBodyScroll();
  closeBtn.focus();
}

function closeOverlay(overlay) {
  if (overlay.hidden) return;
  overlay.hidden = true;
  unlockBodyScroll();
  restoreFocusAfterOverlay();
}

function openHelp() {
  openOverlay(helpOverlay, helpCloseBtn);
}

function closeHelp() {
  closeOverlay(helpOverlay);
}

function openFavorites() {
  renderFavoritesManageList();
  openOverlay(favoritesOverlay, favoritesCloseBtn);
}

function closeFavorites() {
  closeOverlay(favoritesOverlay);
}

function openApiStatus() {
  openOverlay(apiStatusOverlay, apiStatusCloseBtn);
  checkApiStatus();
}

function closeApiStatus() {
  closeOverlay(apiStatusOverlay);
}

helpOpenBtn.addEventListener('click', openHelp);
helpCloseBtn.addEventListener('click', closeHelp);
helpOverlay.addEventListener('click', (event) => {
  if (event.target === helpOverlay) closeHelp();
});

favoritesOpenBtn.addEventListener('click', openFavorites);
favoritesCloseBtn.addEventListener('click', closeFavorites);
favoritesOverlay.addEventListener('click', (event) => {
  if (event.target === favoritesOverlay) closeFavorites();
});

apiStatusOpenBtn.addEventListener('click', openApiStatus);
apiStatusCloseBtn.addEventListener('click', closeApiStatus);
apiStatusOverlay.addEventListener('click', (event) => {
  if (event.target === apiStatusOverlay) closeApiStatus();
});
apiStatusRecheckBtn.addEventListener('click', checkApiStatus);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeHelp();
    closeFavorites();
    closeApiStatus();
    return;
  }
  if (event.key === 'Tab') {
    document.body.classList.add('user-is-tabbing');
    if (!helpOverlay.hidden) trapFocusInPanel(event, helpPanel);
    else if (!favoritesOverlay.hidden) trapFocusInPanel(event, favoritesPanel);
    else if (!apiStatusOverlay.hidden) trapFocusInPanel(event, apiStatusPanel);
  }
});

// El anillo de foco de abajo (ver ".user-is-tabbing" en css) no se deja en manos del
// :focus-visible nativo del navegador: aunque en Chromium de escritorio distingue bien un
// foco real de teclado de uno puesto por script (openOverlay hace closeBtn.focus() al abrir
// un panel, incluso tocando en móvil), reportado en iOS que el anillo se seguía viendo tras
// un simple toque — ese criterio no es igual de fiable en todos los motores. Se controla a
// mano en su lugar: solo cuenta como "usando teclado" tras un Tab real (arriba), y cualquier
// puntero (ratón o toque) lo desactiva enseguida.
document.addEventListener('mousedown', () => document.body.classList.remove('user-is-tabbing'));
document.addEventListener('touchstart', () => document.body.classList.remove('user-is-tabbing'), { passive: true });

// Paradas reales usadas solo para medir latencia, no para mostrar sus tiempos: 07288 (varias
// líneas de CRTM a la vez) y 3351 (parada real de EMT que en su día sacó a la luz el caso "No
// estimations found" — ver CLAUDE.md), las mismas que usa scripts/smoke-test.mjs.
const API_STATUS_CHECKS = [
  { name: 'EMT · tiempos de paso', url: '/api/emt-arrives?stopId=3351' },
  { name: 'Interurbano (CRTM) · tiempos de paso', url: '/api/crtm-arrives?stopId=07288' },
  { name: 'Paradas cercanas', url: '/api/nearby-stops?lat=40.4657&lon=-3.6892' },
];

// Solo mide si la petición completa a tiempo (res.ok) y cuánto tarda — no si esa parada en
// concreto tiene datos ahora mismo. api/emt-arrives.js, por ejemplo, siempre responde 200
// aunque EMT diga "No estimations found" (ver fetchArrivals); solo un fallo real de la propia
// API/proxy (login caído, timeout, etc.) da un status distinto, que es lo que interesa aquí.
async function measureApiLatency({ name, url }) {
  const start = performance.now();
  try {
    const res = await fetch(url);
    const elapsedMs = Math.round(performance.now() - start);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      return { name, elapsedMs, ok: false, message: payload.error || `Error ${res.status}` };
    }
    return { name, elapsedMs, ok: true };
  } catch (err) {
    return { name, elapsedMs: Math.round(performance.now() - start), ok: false, message: err.message };
  }
}

// 3 puntos animados en vez de texto tipo "Comprobando…"/"Cargando…" — ver comentario en
// .loading-dots (css). Compartido entre el panel de Estado de las APIs y la vista previa de
// cada tarjeta de favorito, para no duplicar el markup en los dos sitios.
function loadingDotsHtml(label) {
  return `<span class="loading-dots" role="status" aria-label="${label}"><span class="loading-dots__dot"></span><span class="loading-dots__dot"></span><span class="loading-dots__dot"></span></span>`;
}

function renderApiStatusRow(name, valueText, valueClass) {
  const li = document.createElement('li');
  li.className = 'api-status-row';

  const nameEl = document.createElement('span');
  nameEl.className = 'api-status-row__name';
  nameEl.textContent = name;

  const valueEl = document.createElement('span');
  valueEl.className = `api-status-row__value ${valueClass}`;
  if (valueClass === 'api-status-row__value--pending') {
    valueEl.innerHTML = loadingDotsHtml('Comprobando');
  } else {
    valueEl.textContent = valueText;
  }

  li.append(nameEl, valueEl);
  return li;
}

async function checkApiStatus() {
  apiStatusListEl.innerHTML = '';
  for (const check of API_STATUS_CHECKS) {
    apiStatusListEl.appendChild(renderApiStatusRow(check.name, '', 'api-status-row__value--pending'));
  }

  const results = await Promise.all(API_STATUS_CHECKS.map(measureApiLatency));

  apiStatusListEl.innerHTML = '';
  for (const result of results) {
    if (!result.ok) {
      apiStatusListEl.appendChild(renderApiStatusRow(result.name, result.message || 'Error', 'api-status-row__value--error'));
      continue;
    }
    const valueClass = result.elapsedMs < 1000 ? 'api-status-row__value--ok' : 'api-status-row__value--slow';
    apiStatusListEl.appendChild(renderApiStatusRow(result.name, `${result.elapsedMs} ms`, valueClass));
  }
}

// resetResults solo se usa desde el listener del toggle (abajo): al cambiar de red con una
// parada ya buscada, no hay forma de saber si el número tecleado tiene sentido también en la
// red nueva (EMT y CRTM no comparten numeración, ver CLAUDE.md), así que se limpia el panel y
// la URL en vez de arrastrar los resultados de la red anterior con el estado ya apuntando a
// la nueva. IMPORTANTE: no cortar aquí con un `return` si `network === currentNetwork` — esta
// función también se llama en el arranque con la red ya inicializada por defecto (ver más
// abajo), y #search-btn no trae su clase de color en el HTML estático: un `return` temprano
// dejaría el botón "Buscar" en verde en vez de azul en la primera carga con EMT.
function setNetwork(network, { resetResults = false } = {}) {
  const changed = network !== currentNetwork;
  currentNetwork = network;
  networkToggleBtns.forEach((btn) => {
    const active = btn.dataset.network === network;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  stopInput.placeholder = network === 'crtm' ? 'Ej. 06002' : 'Ej. 72';
  searchBtn.classList.toggle('network-emt', network === 'emt');

  if (changed && resetResults) {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
    currentStopId = null;
    currentStopName = null;
    renderedStopId = null;
    renderedNetwork = null;
    lastArrivals = [];
    resultsEl.hidden = true;
    nearbyResultsEl.hidden = true;
    nearbyRequestId++;
    hideStatus();
    updateFavoriteBtn();
    // Se quita ?stop= de la URL (con replaceState, no pushState, igual que updateUrlForStop)
    // para no dejar un enlace compartible que diga tener una parada de la red anterior.
    const url = new URL(window.location.href);
    url.searchParams.delete('stop');
    url.searchParams.set('network', network);
    history.replaceState(null, '', url);
  }
}

function searchStop(stopId, network = currentNetwork) {
  nearbyResultsEl.hidden = true;
  nearbyRequestId++; // invalida cualquier búsqueda de paradas cercanas que siguiera en vuelo
  setNetwork(network);
  currentStopId = stopId;
  localStorage.setItem(LAST_STOP_STORAGE_KEY, stopId);
  localStorage.setItem(LAST_NETWORK_STORAGE_KEY, network);
  updateUrlForStop(stopId, network);
  fetchArrivals(stopId, network, true);
  // El fallback de horario/frecuencia es una pieza propia de EMT (ver ensureStopSchedule):
  // CRTM ya da siempre una hora de paso utilizable, incluido el hueco nocturno, así que no
  // hace falta nada parecido para esa red.
  if (network === 'emt') ensureStopSchedule(stopId);
  startAutoRefresh();
}

// Deja la parada actual en la URL (?stop=&network=) para poder compartirla o guardarla como
// marcador — replaceState y no pushState, para no llenar el historial con cada búsqueda ni
// que el botón "atrás" tenga que pasar por todas las paradas consultadas en la sesión.
function updateUrlForStop(stopId, network) {
  const url = new URL(window.location.href);
  url.searchParams.set('stop', stopId);
  url.searchParams.set('network', network);
  history.replaceState(null, '', url);
}

// Se pide una sola vez por parada (no en cada refresco): el horario/frecuencia por línea
// apenas cambia, así que no tiene sentido volver a pedirlo cada 30s como los tiempos de paso.
async function ensureStopSchedule(stopId) {
  if (stopScheduleStopId === stopId) return;

  try {
    const res = await fetch(`/api/emt-stop-detail?stopId=${encodeURIComponent(stopId)}`);
    // .catch(): si la función serverless se cuelga hasta el límite de Vercel, la plataforma
    // responde con una página de error en HTML, no JSON — sin esto, res.json() lanzaría un
    // SyntaxError en vez del "falla en silencio" que ya espera el catch de esta función.
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || (payload.code && payload.code !== '00')) return;

    const stop = payload.data?.[0]?.stops?.[0];
    const lines = stop?.dataLine ?? [];
    const today = dayTypeForToday();

    // /transport/busemtmad/stops/{id}/detail/ es un endpoint distinto al de tiempos de paso
    // (/arrives/): sigue dando el nombre real aunque ese otro falle con "No estimations
    // found" — ver renderArrivals, que lo usa como respaldo cuando /arrives/ no trae nombre.
    stopScheduleName = stop?.name || null;

    const byLine = new Map();
    for (const line of lines) {
      const key = String(line.label ?? line.line);
      const existing = byLine.get(key);
      // Si hay varias entradas por tipo de día (LA/SA/FE), nos quedamos con la de hoy;
      // si no hay ninguna que encaje, vale la primera que llegue.
      if (!existing || line.dayType === today) {
        byLine.set(key, line);
      }
    }

    stopSchedule = byLine;
    stopScheduleStopId = stopId;

    // El detalle de la parada suele tardar más que los tiempos de paso (ida y vuelta extra
    // a EMT). Si ya se pintaron resultados para esta parada sin el fallback, se repintan.
    if (currentStopId === stopId && currentNetwork === 'emt' && !resultsEl.hidden) {
      fetchArrivals(stopId, 'emt');
    }
  } catch {
    // El fallback es un extra; si falla, simplemente no se muestra y ya está.
  }
}

// Aproximación LA/SA/FE sin calendario de festivos: domingo se trata como festivo, que es
// el patrón habitual de servicio de EMT. Los festivos entre semana no se detectan.
function dayTypeForToday() {
  const day = new Date().getDay(); // 0 = domingo
  if (day === 0) return 'FE';
  if (day === 6) return 'SA';
  return 'LA';
}

// Paradas cercanas: no hace falta saber el número de parada, solo dar permiso de ubicación.
// api/nearby-stops.js ya mezcla EMT e Interurbano en una sola lista ordenada por distancia,
// así que aquí no hay que filtrar por la red activa del selector.
const GEOLOCATION_ERROR_MESSAGES = {
  1: 'Has denegado el permiso de ubicación — puedes escribir el número de parada a mano.',
  2: 'No se ha podido determinar tu ubicación.',
  3: 'La búsqueda de tu ubicación ha tardado demasiado.',
};

nearbyBtn.addEventListener('click', searchNearbyStops);
nearbyCloseBtn.addEventListener('click', () => {
  nearbyResultsEl.hidden = true;
  nearbyRequestId++; // si aún hay una búsqueda en vuelo, que no reabra el panel al resolver
});

// Igual que isCurrentRequest para fetchArrivals: getCurrentPosition + /api/nearby-stops
// puede resolver después de que el usuario ya haya buscado una parada (o cerrado este mismo
// panel) — sin este token, renderNearbyList reabría el panel de cercanías encima de lo que
// se estuviera viendo, con hideStatus() de propina pisando el status de la otra búsqueda.
let nearbyRequestId = 0;

function searchNearbyStops() {
  const requestId = ++nearbyRequestId;

  if (!('geolocation' in navigator)) {
    nearbyResultsEl.hidden = true;
    showStatus('Este navegador no admite geolocalización.', 'error');
    return;
  }

  resultsEl.hidden = true;
  nearbyResultsEl.hidden = true;
  showStatus('Buscando tu ubicación…', 'loading');

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      if (requestId !== nearbyRequestId) return;
      showStatus('Buscando paradas cercanas…', 'loading');
      try {
        const { latitude, longitude } = position.coords;
        const res = await fetch(`/api/nearby-stops?lat=${latitude}&lon=${longitude}`);
        const payload = await res.json().catch(() => ({}));
        if (requestId !== nearbyRequestId) return;
        if (!res.ok) throw new Error(payload.error || `Error ${res.status}`);
        renderNearbyList(payload.stops ?? []);
      } catch (err) {
        if (requestId !== nearbyRequestId) return;
        showStatus(`No se han podido buscar paradas cercanas: ${err.message}`, 'error');
      }
    },
    (err) => {
      if (requestId !== nearbyRequestId) return;
      showStatus(GEOLOCATION_ERROR_MESSAGES[err.code] ?? 'No se ha podido obtener tu ubicación.', 'error');
    },
    { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
  );
}

function renderNearbyList(stops) {
  if (stops.length === 0) {
    showStatus('No se han encontrado paradas a menos de 300 m.', 'error');
    return;
  }

  hideStatus();
  nearbyListEl.innerHTML = '';

  for (const stop of stops) {
    const li = document.createElement('li');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nearby-stop';
    btn.addEventListener('click', () => {
      stopInput.value = stop.stopId;
      searchStop(stop.stopId, stop.network);
    });

    const top = document.createElement('span');
    top.className = 'nearby-stop__top';

    const badge = document.createElement('span');
    badge.className = 'nearby-stop__network';
    badge.dataset.network = stop.network;
    badge.textContent = FAVORITE_NETWORK_LABELS[stop.network] ?? stop.network;

    const name = document.createElement('span');
    name.className = 'nearby-stop__name';
    name.textContent = stop.name || `Parada ${stop.stopId}`;

    const distance = document.createElement('span');
    distance.className = 'nearby-stop__distance';
    distance.textContent = formatDistance(stop.distanceMeters);

    top.append(badge, name, distance);

    const lines = document.createElement('span');
    lines.className = 'nearby-stop__lines';
    lines.textContent = stop.lines.join(' · ');

    btn.append(top, lines);
    li.appendChild(btn);
    nearbyListEl.appendChild(li);
  }

  nearbyResultsEl.hidden = false;
}

// Favoritos: solo en localStorage de este navegador (ver panel de ayuda) — sin cuentas
// ni sincronización entre dispositivos.
function getFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavorites(list) {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(list));
}

// Favoritos guardados antes de que existiera CRTM no tienen "network": se tratan como EMT,
// que era la única red posible entonces. Necesario para no confundir un "72" de EMT con un
// "72" de interurbanos: ambos números de parada son válidos pero pertenecen a paradas
// completamente distintas.
function favoriteNetwork(fav) {
  return fav.network || 'emt';
}

function isFavorite(stopId, network) {
  return getFavorites().some((fav) => fav.stopId === stopId && favoriteNetwork(fav) === network);
}

function toggleFavorite(stopId, network, stopName) {
  const favorites = getFavorites();
  const index = favorites.findIndex((fav) => fav.stopId === stopId && favoriteNetwork(fav) === network);
  if (index >= 0) {
    favorites.splice(index, 1);
  } else {
    favorites.push({ stopId, network, name: stopName || null });
  }
  saveFavorites(favorites);
}

function removeFavorite(stopId, network) {
  saveFavorites(getFavorites().filter((fav) => !(fav.stopId === stopId && favoriteNetwork(fav) === network)));
}

function updateFavoriteBtn() {
  const active = currentStopId && isFavorite(currentStopId, currentNetwork);
  // Mismo icono de corazón en los dos estados — de contorno o relleno según .active (ver
  // ".icon-heart" en el CSS), en vez de textContent con dos caracteres Unicode distintos.
  if (!favoriteBtn.querySelector('svg')) favoriteBtn.innerHTML = ICON_HEART;
  favoriteBtn.classList.toggle('active', Boolean(active));
  // aria-label además de title: un lector de pantalla usa aria-label con prioridad sobre
  // title para el nombre accesible del botón, así que sin esto siempre anunciaría "Guardar
  // como favorita" aunque la parada ya estuviera marcada (confirmado con Playwright: el
  // title sí cambiaba, el aria-label se quedaba fijo desde el HTML estático).
  const label = active ? 'Quitar de favoritos' : 'Guardar como favorita';
  favoriteBtn.title = label;
  favoriteBtn.setAttribute('aria-label', label);
}

function updateFavoriteName(stopId, network, name) {
  const favorites = getFavorites();
  const fav = favorites.find((f) => f.stopId === stopId && favoriteNetwork(f) === network);
  if (!fav) return;
  fav.name = name || null;
  saveFavorites(favorites);
}

function moveFavorite(index, direction) {
  const favorites = getFavorites();
  const target = index + direction;
  if (target < 0 || target >= favorites.length) return;
  [favorites[index], favorites[target]] = [favorites[target], favorites[index]];
  saveFavorites(favorites);
  renderFavoritesManageList();
}

// Líneas favoritas: igual que las paradas, solo en localStorage y por red — un "27" de EMT
// y un "27" de Interurbano son líneas distintas. Se guardan aparte de las paradas favoritas
// porque una línea puede marcarse como favorita en cualquier parada donde aparezca, no solo
// en las paradas guardadas.
function getFavoriteLines() {
  try {
    const raw = localStorage.getItem(FAVORITE_LINES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavoriteLines(list) {
  localStorage.setItem(FAVORITE_LINES_STORAGE_KEY, JSON.stringify(list));
}

function isFavoriteLine(line, network) {
  const key = String(line);
  return getFavoriteLines().some((fav) => fav.line === key && fav.network === network);
}

function toggleFavoriteLine(line, network) {
  const favorites = getFavoriteLines();
  const key = String(line);
  const index = favorites.findIndex((fav) => fav.line === key && fav.network === network);
  if (index >= 0) {
    favorites.splice(index, 1);
  } else {
    favorites.push({ line: key, network });
  }
  saveFavoriteLines(favorites);
}

// Panel de favoritos: una tarjeta por parada (mismo estilo que el panel de resultados),
// independiente del buscador — se abre desde la topbar, con nombre editable y orden propio.
function renderFavoritesManageList() {
  const favorites = getFavorites();
  favoritesEmptyEl.hidden = favorites.length > 0;
  favoritesManageListEl.innerHTML = '';

  favorites.forEach((fav, index) => {
    favoritesManageListEl.appendChild(renderFavoriteCard(fav, index, favorites.length));
  });
}

// Exportar/importar favoritos (paradas + líneas) como un único archivo JSON: única forma de
// llevárselos a otro navegador/dispositivo, dado que se guardan solo en localStorage (ver
// panel de ayuda) y la app no tiene cuentas ni servidor propio para sincronizarlos.
function flashButtonText(btn, text, ms = 1800) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = text;
  setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, ms);
}

favoritesExportBtn.addEventListener('click', () => {
  const data = {
    app: 'busya',
    version: 1,
    exportedAt: new Date().toISOString(),
    favorites: getFavorites(),
    favoriteLines: getFavoriteLines(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `busya-favoritos-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

favoritesImportBtn.addEventListener('click', () => favoritesImportInput.click());

// Fusiona en vez de reemplazar: importar no debe poder borrar favoritos que ya había, solo
// añadir los que falten. Un favorito ya existente (mismo stopId+network o línea+network) se
// deja tal cual, no se sobrescribe su nombre ni su orden.
function mergeFavoritesInto(existing, incoming) {
  let added = 0;
  for (const fav of incoming) {
    if (!fav || typeof fav.stopId !== 'string') continue;
    const network = fav.network === 'crtm' ? 'crtm' : 'emt';
    if (existing.some((f) => f.stopId === fav.stopId && favoriteNetwork(f) === network)) continue;
    existing.push({ stopId: fav.stopId, network, name: typeof fav.name === 'string' ? fav.name : null });
    added++;
  }
  return added;
}

function mergeFavoriteLinesInto(existing, incoming) {
  let added = 0;
  for (const fav of incoming) {
    if (!fav || (typeof fav.line !== 'string' && typeof fav.line !== 'number')) continue;
    const network = fav.network === 'crtm' ? 'crtm' : 'emt';
    const key = String(fav.line);
    if (existing.some((f) => f.line === key && f.network === network)) continue;
    existing.push({ line: key, network });
    added++;
  }
  return added;
}

favoritesImportInput.addEventListener('change', async () => {
  const file = favoritesImportInput.files?.[0];
  // Se limpia ya mismo, no al final: si no, seleccionar el mismo archivo dos seguidas (p.ej.
  // tras corregirlo) no dispararía un segundo "change".
  favoritesImportInput.value = '';
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    const incomingFavorites = Array.isArray(data.favorites) ? data.favorites : [];
    const incomingLines = Array.isArray(data.favoriteLines) ? data.favoriteLines : [];
    if (incomingFavorites.length === 0 && incomingLines.length === 0) {
      throw new Error('vacío');
    }

    const favorites = getFavorites();
    const addedFavorites = mergeFavoritesInto(favorites, incomingFavorites);
    saveFavorites(favorites);

    const favoriteLines = getFavoriteLines();
    const addedLines = mergeFavoriteLinesInto(favoriteLines, incomingLines);
    saveFavoriteLines(favoriteLines);

    renderFavoritesManageList();
    updateFavoriteBtn();
    // Si hay una parada abierta ahora mismo, sus badges de línea reflejan al instante una
    // línea recién importada como favorita, sin esperar al próximo refresco de 30s.
    if (!resultsEl.hidden) renderArrivalsList(lastArrivals, currentNetwork);

    flashButtonText(favoritesImportBtn, `✓ ${addedFavorites + addedLines} añadidos`);
  } catch {
    flashButtonText(favoritesImportBtn, 'Archivo no válido');
  }
});

function renderFavoriteCard(fav, index, total) {
  const network = favoriteNetwork(fav);
  const card = document.createElement('div');
  card.className = 'panel favorite-card';

  const header = document.createElement('div');
  header.className = 'favorite-card__header';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'favorite-card__name';
  nameInput.value = fav.name || '';
  nameInput.placeholder = `Parada ${fav.stopId}`;
  nameInput.setAttribute('aria-label', `Nombre de la parada ${fav.stopId}`);
  nameInput.addEventListener('change', () => updateFavoriteName(fav.stopId, network, nameInput.value.trim()));
  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') nameInput.blur();
  });

  const actions = document.createElement('div');
  actions.className = 'favorite-card__actions';

  const upBtn = document.createElement('button');
  upBtn.type = 'button';
  upBtn.className = 'help-btn';
  upBtn.innerHTML = ICON_ARROW_UP;
  upBtn.setAttribute('aria-label', 'Subir en la lista');
  upBtn.disabled = index === 0;
  upBtn.addEventListener('click', () => moveFavorite(index, -1));

  const downBtn = document.createElement('button');
  downBtn.type = 'button';
  downBtn.className = 'help-btn';
  downBtn.innerHTML = ICON_ARROW_DOWN;
  downBtn.setAttribute('aria-label', 'Bajar en la lista');
  downBtn.disabled = index === total - 1;
  downBtn.addEventListener('click', () => moveFavorite(index, 1));

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'help-btn';
  removeBtn.innerHTML = ICON_CLOSE;
  removeBtn.setAttribute('aria-label', `Quitar ${fav.name || fav.stopId} de favoritos`);
  removeBtn.addEventListener('click', () => {
    removeFavorite(fav.stopId, network);
    renderFavoritesManageList();
    updateFavoriteBtn();
  });

  actions.append(upBtn, downBtn, removeBtn);
  header.append(nameInput, actions);

  const meta = document.createElement('div');
  meta.className = 'favorite-card__meta';

  const metaLeft = document.createElement('div');
  metaLeft.className = 'favorite-card__meta-left';

  const networkEl = document.createElement('span');
  networkEl.className = 'favorite-card__network';
  networkEl.dataset.network = network;
  networkEl.textContent = FAVORITE_NETWORK_LABELS[network] ?? network;

  const stopIdEl = document.createElement('span');
  stopIdEl.textContent = `Parada ${fav.stopId}`;

  metaLeft.append(networkEl, stopIdEl);

  const viewBtn = document.createElement('button');
  viewBtn.type = 'button';
  viewBtn.className = 'favorite-card__view';
  viewBtn.textContent = 'Ver tiempos →';
  viewBtn.addEventListener('click', () => {
    closeFavorites();
    stopInput.value = fav.stopId;
    searchStop(fav.stopId, network);
  });

  meta.append(metaLeft, viewBtn);

  const preview = document.createElement('div');
  preview.className = 'favorite-card__preview favorite-card__preview--empty';
  preview.innerHTML = loadingDotsHtml('Cargando');
  loadFavoriteCardPreview(fav.stopId, network, preview);

  card.append(header, meta, preview);
  return card;
}

// Vista previa de tiempos dentro de cada tarjeta de favorito: no sustituye a "Ver tiempos →"
// (que sigue llevando a la vista completa, con refresco cada 30s y demás), es solo un
// vistazo rápido de las 2 llegadas más próximas sin tener que entrar. Se pide una vez al
// abrir el panel, no se refresca sola mientras está abierto — para eso ya está "Ver tiempos".
async function loadFavoriteCardPreview(stopId, network, previewEl) {
  try {
    const endpoint = network === 'crtm' ? '/api/crtm-arrives' : '/api/emt-arrives';
    const res = await fetch(`${endpoint}?stopId=${encodeURIComponent(stopId)}`);
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(payload.error || `Error ${res.status}`);

    if (payload.code && payload.code !== '00') {
      // Mismo caso que en fetchArrivals: "No estimations found" es una parada real sin
      // tiempos ahora mismo, no un fallo.
      const description = network === 'emt' ? emtDescriptionText(payload.description) : payload.description;
      if (network === 'emt' && /no estimations found/i.test(description || '')) {
        renderFavoriteCardPreviewEmpty(previewEl);
        return;
      }
      throw new Error(description || 'Error');
    }

    const normalized = network === 'crtm' ? normalizeCrtm(payload) : normalizeEmt(payload);
    if (normalized.arrivals.length === 0) {
      renderFavoriteCardPreviewEmpty(previewEl);
      return;
    }

    const soonest = [...normalized.arrivals].sort((a, b) => a.estimateArrive - b.estimateArrive).slice(0, 2);
    renderFavoriteCardPreviewItems(previewEl, soonest, network);
  } catch {
    // Best-effort: si falla, se avisa discretamente en el propio hueco de la vista previa en
    // vez de con el status de error de toda la app — no es la búsqueda que ha pedido el
    // usuario explícitamente, es un vistazo de fondo dentro de una tarjeta.
    previewEl.className = 'favorite-card__preview favorite-card__preview--empty';
    previewEl.textContent = 'No se pudo cargar.';
  }
}

function renderFavoriteCardPreviewEmpty(previewEl) {
  previewEl.className = 'favorite-card__preview favorite-card__preview--empty';
  previewEl.textContent = 'Sin buses ahora.';
}

function renderFavoriteCardPreviewItems(previewEl, arrivals, network) {
  previewEl.className = 'favorite-card__preview';
  previewEl.innerHTML = '';
  for (const arrival of arrivals) {
    const item = document.createElement('span');
    item.className = 'favorite-card__preview-item';

    const line = document.createElement('span');
    line.className = 'favorite-card__preview-line';
    line.dataset.network = network;
    line.textContent = arrival.line;

    const eta = document.createElement('span');
    eta.className = `favorite-card__preview-eta ${etaClass(arrival.estimateArrive, network)}`;
    eta.textContent = formatEta(arrival.estimateArrive, network);

    item.append(line, eta);
    previewEl.appendChild(item);
  }
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (currentStopId) fetchArrivals(currentStopId, currentNetwork);
  }, REFRESH_INTERVAL_MS);
}

// Si se selecciona una parada y enseguida otra (p.ej. un favorito de EMT y justo después uno
// de CRTM) quedan dos peticiones en vuelo a la vez; sin esta comprobación, la que tarde más
// en responder —aunque sea la vieja— pisa igualmente la pantalla al llegar, incluso pudiendo
// mostrar un error de una parada que ya no es la que se está mirando.
function isCurrentRequest(stopId, network) {
  return stopId === currentStopId && network === currentNetwork;
}

async function fetchArrivals(stopId, network, isExplicitSearch = false) {
  // Solo se muestra "Buscando parada…" en la primera carga (resultsEl aún oculto). En los
  // refrescos de cada 30s el panel ya está visible con datos: mostrar y ocultar ese aviso en
  // cada vuelta es lo que producía el salto arriba-abajo del panel.
  const isFirstLoad = resultsEl.hidden;
  if (isFirstLoad) showStatus('Buscando parada…', 'loading');

  try {
    const endpoint = network === 'crtm' ? '/api/crtm-arrives' : '/api/emt-arrives';
    const res = await fetch(`${endpoint}?stopId=${encodeURIComponent(stopId)}`);
    // .catch(): un cuelgue de la función serverless que llegue al límite de Vercel responde
    // con una página HTML, no JSON — sin esto, res.json() lanzaba un SyntaxError críptico
    // ("Unexpected token '<'...") en vez del mensaje de error legible de más abajo.
    const payload = await res.json().catch(() => ({}));

    if (!isCurrentRequest(stopId, network)) return;

    if (!res.ok) {
      throw new Error(payload.error || `Error ${res.status}`);
    }

    if (payload.code && payload.code !== '00') {
      // Confirmado en producción con la parada 3351: EMT usa un code de error con
      // description "No estimations found" para una parada real que simplemente no tiene
      // tiempos ahora mismo — no para una parada inválida. Otras apps de EMT lo tratan como
      // un estado normal (sin buses ahora), no como fallo, así que aquí también.
      const description = network === 'emt' ? emtDescriptionText(payload.description) : payload.description;
      if (network === 'emt' && /no estimations found/i.test(description || '')) {
        renderArrivals({ stopName: null, arrivals: [] }, network);
        return;
      }

      // Confirmado en producción con la parada 51159 (Abtao-Av.del Mediterráneo, línea 145):
      // EMT usa el mismo code ("80", "Parada no disponible actualmente o inexistente") tanto
      // para una parada que de verdad no existe como para una real que solo está desactivada
      // para tiempo real ahora mismo — /detail/ sí la conoce (nombre, líneas, horario) aunque
      // /arrives/ no. Antes de darlo por error duro, se comprueba eso: si /detail/ tiene datos
      // de esta parada, se muestra el horario/frecuencia de cada línea (mismo mecanismo que ya
      // usa formatScheduleFallback para líneas nocturnas sin GPS) en vez de un error; si /detail/
      // tampoco tiene nada, es que la parada de verdad no existe y sí toca el error de abajo.
      if (network === 'emt') {
        await ensureStopSchedule(stopId);
        if (!isCurrentRequest(stopId, network)) return;
        if (stopScheduleStopId === stopId && stopSchedule?.size > 0) {
          renderArrivals({ stopName: null, arrivals: scheduleOnlyArrivals() }, network);
          return;
        }
      }

      throw new Error(description || `La API de ${NETWORK_LABELS[network]} devolvió un error`);
    }

    const normalized = network === 'crtm' ? normalizeCrtm(payload) : normalizeEmt(payload);

    renderArrivals(normalized, network);
  } catch (err) {
    if (!isCurrentRequest(stopId, network)) return;
    console.error(`Petición de la parada ${stopId} falló:`, err.message);

    // Si lo que hay en pantalla ahora mismo es justo de esta misma parada (una carga o
    // refresco anterior que sí funcionó), es mejor dejarlo y avisar de que está desactualizado
    // que borrarlo por un fallo puntual de red — sigue siendo útil aunque ya no se pueda
    // actualizar en este momento. Si lo que se ve es de otra parada distinta (p.ej. una
    // búsqueda nueva que falla con los resultados de la anterior aún visibles), no aplica:
    // eso hay que seguir avisándolo como error, no dejarlo ahí puesto por otra parada.
    const hasMatchingDataShown = !resultsEl.hidden && renderedStopId === stopId && renderedNetwork === network;
    if (hasMatchingDataShown) {
      showOfflineNotice();
      return;
    }

    // isFirstLoad (nada en pantalla aún) o isExplicitSearch (el usuario pidió justo esta
    // parada, aunque hubiera resultados de otra parada anterior todavía visibles) siempre
    // muestran el error. Solo el refresco automático en segundo plano se traga fallos
    // puntuales en silencio (ya registrado arriba en consola) cuando tampoco hay datos
    // propios de esta parada que conservar.
    if (isFirstLoad || isExplicitSearch) {
      showStatus(`No se pudo obtener la parada ${stopId}: ${err.message}`, 'error');
      resultsEl.hidden = true;
    }
  }
}

// A partir de aquí los tiempos ya en pantalla pueden estar desactualizados — se avisa en el
// mismo sitio donde se dice "Actualizado HH:MM:SS" en vez de con un aviso aparte, ya que dice
// justo lo mismo (cuándo son los datos que se están viendo) solo que ahora no se pueden dar
// por buenos. Se limpia solo en el próximo renderArrivals que funcione (refresco automático
// de 30s incluido), sin que haga falta ningún reintento manual.
function showOfflineNotice() {
  const minutes = lastSuccessAt ? Math.max(0, Math.round((Date.now() - lastSuccessAt.getTime()) / 60_000)) : null;
  const agoText = minutes == null ? '' : minutes < 1 ? 'de hace un momento' : `de hace ${minutes} min`;
  lastUpdatedEl.textContent = `Sin conexión — datos ${agoText}`.trim();
  lastUpdatedEl.classList.add('last-updated--offline');
}

// La API de EMT no es consistente en el formato de "description": a veces es un string
// plano ("No estimations found (lapsed: ...)"), pero para una parada que no existe/está
// deshabilitada (code "80", confirmado en vivo con stopId "07289") es un array de objetos
// localizados, [{ES:"..."},{EN:"..."}] — sin esto, un new Error(payload.description) sobre
// ese array acababa mostrando el literal "[object Object],[object Object]" en pantalla en
// vez de un mensaje legible.
function emtDescriptionText(description) {
  if (typeof description === 'string') return description;
  if (Array.isArray(description)) {
    const es = description.find((d) => d && typeof d === 'object' && 'ES' in d);
    if (es) return es.ES;
    const first = description.find((d) => d && typeof d === 'object');
    if (first) return Object.values(first)[0];
  }
  return null;
}

// Ambas redes se reducen a la misma forma { stopName, arrivals: [{line, destination,
// estimateArrive, DistanceBus?}] } para que el resto del pintado no tenga que saber de
// dónde vino cada dato.
function normalizeEmt(payload) {
  // Con code:'00' (éxito) EMT puede devolver "data" vacío para una parada real que
  // simplemente no tiene tiempos reales ni programados ahora mismo (confirmado: otras apps
  // muestran esto como un estado normal, no como "parada no encontrada"). Antes esto se
  // trataba como error duro por no distinguir "sin datos ahora" de "parada inválida" —
  // lo segundo ya lo cubre el chequeo de payload.code en fetchArrivals antes de llegar aquí.
  const stopData = payload.data?.[0];
  const stopInfo = stopData?.StopInfo?.[0];
  return { stopName: stopInfo?.stopName || null, arrivals: stopData?.Arrive ?? [] };
}

function normalizeCrtm(payload) {
  return { stopName: payload.stopName || null, arrivals: payload.arrivals ?? [] };
}

function renderArrivals(normalized, network) {
  const { arrivals } = normalized;

  // /api/emt-arrives a veces no trae nombre (p.ej. "No estimations found": la otra app
  // también muestra el nombre real ahí, en vez de "Parada X"). /api/emt-stop-detail es un
  // endpoint distinto que sigue dando el nombre aunque ese falle, así que se usa como
  // respaldo cuando está disponible para esta misma parada.
  const fallbackName = network === 'emt' && stopScheduleStopId === currentStopId ? stopScheduleName : null;
  currentStopName = normalized.stopName || fallbackName;
  stopNameEl.textContent = currentStopName
    ? `${currentStopName} (parada ${currentStopId})`
    : `Parada ${currentStopId}`;

  // Si esta parada ya estaba en favoritos sin nombre (se guardó antes de tener este dato),
  // se completa en silencio la próxima vez que se consulta.
  if (currentStopName && isFavorite(currentStopId, network)) {
    const favorites = getFavorites();
    const fav = favorites.find((f) => f.stopId === currentStopId && favoriteNetwork(f) === network);
    if (fav && !fav.name) {
      fav.name = currentStopName;
      saveFavorites(favorites);
    }
  }

  updateFavoriteBtn();

  lastArrivals = arrivals;
  renderArrivalsList(arrivals, network);

  renderedStopId = currentStopId;
  renderedNetwork = network;
  lastSuccessAt = new Date();
  lastUpdatedEl.classList.remove('last-updated--offline');
  lastUpdatedEl.textContent = `Actualizado ${formatTime(lastSuccessAt)}`;
  hideStatus();
  resultsEl.hidden = false;
}

// Cuántas llegadas de una misma línea favorita suben al principio de la lista. Sin este
// límite, una línea favorita con muchos pasos programados (p.ej. en CRTM, donde una parada
// puede servir los dos sentidos de una línea — ver normalizeCrtm) podía tapar con una
// llegada lejana el próximo bus real de otra línea, que quedaba escondido más abajo.
const FAVORITE_LINE_PROMOTE_LIMIT = 3;

function renderArrivalsList(arrivals, network) {
  arrivalsListEl.innerHTML = '';

  if (arrivals.length === 0) {
    const li = document.createElement('li');
    li.className = 'arrivals-list__empty';
    li.textContent = 'No hay buses en camino ahora mismo.';
    arrivalsListEl.appendChild(li);
  } else {
    const byEta = [...arrivals].sort((a, b) => a.estimateArrive - b.estimateArrive);

    // Solo las FAVORITE_LINE_PROMOTE_LIMIT llegadas más próximas de cada línea favorita
    // suben al principio; el resto (incluidas llegadas posteriores de esa misma línea) se
    // queda en su sitio cronológico normal, mezclado con las demás líneas.
    const promotedCountByLine = new Map();
    const promoted = [];
    const rest = [];
    for (const arrival of byEta) {
      if (isFavoriteLine(arrival.line, network)) {
        const key = String(arrival.line);
        const count = promotedCountByLine.get(key) ?? 0;
        if (count < FAVORITE_LINE_PROMOTE_LIMIT) {
          promotedCountByLine.set(key, count + 1);
          promoted.push(arrival);
          continue;
        }
      }
      rest.push(arrival);
    }

    for (const arrival of [...promoted, ...rest]) {
      arrivalsListEl.appendChild(renderArrivalItem(arrival, network));
    }
  }
}

function renderArrivalItem(arrival, network) {
  const li = document.createElement('li');
  li.className = 'arrival-item';

  const lineIsFavorite = isFavoriteLine(arrival.line, network);
  const line = document.createElement('button');
  line.type = 'button';
  // Azul para EMT, verde para interurbanos — el mismo código de color de los buses reales
  // en Madrid (verde ya es el acento por defecto de la app, así que solo EMT necesita clase).
  line.className = [
    'arrival-item__line',
    network === 'emt' ? 'arrival-item__line--emt' : '',
    lineIsFavorite ? 'arrival-item__line--favorite' : '',
  ].filter(Boolean).join(' ');
  line.textContent = arrival.line;
  line.setAttribute('aria-pressed', String(lineIsFavorite));
  line.title = lineIsFavorite ? 'Quitar la línea de favoritas' : 'Marcar la línea como favorita';
  line.addEventListener('click', () => {
    toggleFavoriteLine(arrival.line, network);
    renderArrivalsList(lastArrivals, network);
  });

  const destination = document.createElement('span');
  destination.className = 'arrival-item__destination';
  destination.textContent = arrival.destination;

  const eta = document.createElement('span');
  eta.className = `arrival-item__eta ${etaClass(arrival.estimateArrive, network)}`;
  eta.textContent = formatEta(arrival.estimateArrive, network);

  const distance = document.createElement('span');
  distance.className = 'arrival-item__distance';
  // CRTM no muestra distancia: solo se podía aproximar en línea recta a partir de la posición
  // en vivo de "algún" vehículo de esa línea+sentido, sin forma fiable de saber si era el que
  // realmente iba a pasar por esta parada — tras varios intentos de arreglarlo (repetía la
  // misma distancia entre llegadas, o mostraba valores físicamente imposibles), es un dato que
  // sale mal la mayoría de las veces y es mejor no mostrar nada que mostrar algo erróneo.
  if (network === 'emt') {
    if (hasReliableEta(arrival.estimateArrive, network)) {
      // Sin ETA fiable no hay posición real del bus; DistanceBus no es un dato útil en ese caso.
      distance.textContent = formatDistance(arrival.DistanceBus);
    } else {
      distance.textContent = formatScheduleFallback(arrival.line);
    }
  }

  li.append(line, destination, eta, distance);
  return li;
}

// Fila por línea a partir solo del horario de ensureStopSchedule, sin ningún dato de tiempo
// real (ver el caso "parada 80" de fetchArrivals) — sin estimateArrive/DistanceBus, así que
// hasReliableEta() ya los trata como "sin estimación" y renderArrivalItem cae solo en
// formatScheduleFallback para la distancia, el mismo mecanismo que ya usan las líneas
// nocturnas sin GPS, sin necesitar un camino de pintado aparte.
function scheduleOnlyArrivals() {
  if (!stopSchedule) return [];
  return [...stopSchedule.values()].map((info) => ({
    line: info.label ?? info.line,
    destination: info.direction === 'A' ? info.headerA : info.headerB,
  }));
}

// Cuando no hay tiempo real fiable, cae al horario/frecuencia de la línea (si ya se cargó
// para esta parada vía ensureStopSchedule) en vez de dejar el hueco vacío.
function formatScheduleFallback(line) {
  if (stopScheduleStopId !== currentStopId || !stopSchedule) return '';

  const info = stopSchedule.get(String(line));
  if (!info?.startTime || !info?.stopTime) return '';

  const startMin = parseTimeToMinutes(info.startTime);
  const stopMin = parseTimeToMinutes(info.stopTime);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  if (startMin == null || stopMin == null) return '';

  if (!isServiceActive(nowMin, startMin, stopMin)) {
    return `Fuera de servicio · reanuda ${formatHHMM(info.startTime)}`;
  }

  const minFreq = Number(info.minFreq) || 0;
  const maxFreq = Number(info.maxFreq) || 0;
  const freqText = minFreq && maxFreq
    ? (minFreq === maxFreq ? `cada ${minFreq} min` : `cada ${minFreq}-${maxFreq} min`)
    : null;

  return freqText
    ? `${freqText} · hasta ${formatHHMM(info.stopTime)}`
    : `Servicio hasta ${formatHHMM(info.stopTime)}`;
}

function parseTimeToMinutes(hhmmss) {
  const match = /^(\d{1,2}):(\d{2})/.exec(hhmmss);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatHHMM(hhmmss) {
  return hhmmss.slice(0, 5);
}

// Las líneas nocturnas cruzan medianoche (p.ej. inicio 23:55, fin 06:00), así que el
// intervalo activo puede "envolver" en vez de ser start <= now <= stop.
function isServiceActive(nowMin, startMin, stopMin) {
  if (startMin <= stopMin) {
    return nowMin >= startMin && nowMin <= stopMin;
  }
  return nowMin >= startMin || nowMin <= stopMin;
}

// EMT documenta 999999 como "sin estimación" (>45min en líneas normales, >90min en nocturnas),
// pero en la práctica las líneas nocturnas (N-) a veces devuelven valores absurdos en vez de ese
// sentinel cuando no hay GPS en tiempo real (p.ej. "14815 min" en vez de 999999). Cualquier
// estimación por encima de 90 min es igual de poco fiable, la trituremos o no como sentinel exacto.
// CRTM no tiene nada parecido: su estimateArrive siempre es una hora de paso real, calculada
// aquí mismo a partir de un timestamp — puede ser legítimamente de varias horas (p.ej. el
// primer bus de la mañana consultado de madrugada), así que este límite no se le aplica.
const MAX_RELIABLE_ETA_SECONDS = 90 * 60;

function hasReliableEta(seconds, network) {
  // Number.isFinite en vez de typeof === 'number': typeof NaN también es 'number', y NaN
  // se cuela aquí si algún día `seconds` viniera de un cálculo con una fecha inválida (ver
  // fetchArrivals de api/crtm-arrives.js) en vez de null/undefined.
  if (!Number.isFinite(seconds)) return false;
  if (network === 'crtm') return true;
  return seconds <= MAX_RELIABLE_ETA_SECONDS;
}

// A partir de aquí, la cuenta atrás en minutos es menos útil que saber directamente a qué
// hora pasa — nadie se queda mirando el contador 50 minutos, y una hora de reloj se recuerda
// sin volver a abrir la app.
const CLOCK_TIME_THRESHOLD_SECONDS = 45 * 60;

function formatEta(seconds, network) {
  if (!hasReliableEta(seconds, network)) return 'Sin estimación';
  if (seconds < 60) return 'Llegando';
  // Se trunca hacia abajo, no se redondea: como una cuenta atrás real, solo baja de "2 min" a
  // "1 min" cuando ya ha pasado el minuto completo — redondear hacía que BusYa mostrara un
  // minuto más que otras apps (EMT oficial, Google Maps) en la mitad de cada minuto.
  if (seconds < CLOCK_TIME_THRESHOLD_SECONDS) return `${Math.floor(seconds / 60)} min`;
  const arrivalTime = new Date(Date.now() + seconds * 1000);
  return arrivalTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function etaClass(seconds, network) {
  if (!hasReliableEta(seconds, network)) return 'eta-unknown';
  if (seconds < 60) return 'eta-now';
  if (seconds < 300) return 'eta-soon';
  return '';
}

function formatDistance(meters) {
  if (meters == null) return '';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
}

function formatTime(date) {
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function showStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = `status status--${kind}`;
  statusEl.hidden = false;
}

function hideStatus() {
  statusEl.hidden = true;
}

// Un enlace directo (?stop=&network=, ver updateUrlForStop) manda por delante de la última
// parada consultada en este navegador — es justo para eso, para poder abrir la parada de
// otra persona sin que la propia sobrescriba lo que se quería compartir.
const urlParams = new URLSearchParams(window.location.search);
const urlStopId = urlParams.get('stop');
const initialNetwork = urlStopId
  ? (urlParams.get('network') === 'crtm' ? 'crtm' : 'emt')
  : (localStorage.getItem(LAST_NETWORK_STORAGE_KEY) || 'emt');
const initialStopId = urlStopId || localStorage.getItem(LAST_STOP_STORAGE_KEY);

setNetwork(initialNetwork);
if (initialStopId) {
  stopInput.value = initialStopId;
  searchStop(initialStopId, initialNetwork);
}

// Cachea el shell de la app (ver sw.js) para que la PWA instalada cargue al instante y
// funcione sin conexión. Si el registro falla (p.ej. servido por HTTP en algún entorno
// local) no es grave: se registra en consola y ya está, la app sigue funcionando igual.
if ('serviceWorker' in navigator) {
  // En la primera visita de siempre no hay ningún controller todavía; clients.claim() del
  // propio sw.js hace que ESA primera instalación también dispare "controllerchange" más
  // abajo, aunque no sea ninguna actualización real. Sin esta comprobación, cualquiera que
  // abriera la app por primera vez vería el aviso de "versión nueva disponible" sin sentido.
  const hadControllerBeforeRegister = Boolean(navigator.serviceWorker.controller);

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.error('SW registration failed', err));
  });

  // sw.js llama a skipWaiting()/clients.claim(), así que una versión nueva toma el control
  // de una pestaña ya abierta de inmediato — pero esa pestaña sigue con el html/css/js
  // antiguo ya cargado en memoria hasta que se recarga. "controllerchange" se dispara justo
  // en ese momento; en vez de recargar solo (podría cortar a media búsqueda o al escribir un
  // número de parada), se avisa con un botón y se recarga cuando el usuario quiera. Con
  // guarda para no mostrar el aviso dos veces, ya que el evento en teoría puede repetirse.
  let updateAvailable = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateAvailable || !hadControllerBeforeRegister) return;
    updateAvailable = true;
    updateBanner.hidden = false;
  });

  updateReloadBtn.addEventListener('click', () => window.location.reload());

  // El navegador solo revisa sw.js en busca de cambios según su propio calendario (más o
  // menos cada 24h, o al navegar) — para una PWA que se reabre desde segundo plano en vez
  // de recargarse, eso puede dejarla desactualizada mucho más tiempo del deseado. Volver a
  // comprobar cada vez que la pestaña vuelve a ser visible detecta antes las novedades.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker.getRegistration().then((reg) => reg && reg.update());
    }
  });
}

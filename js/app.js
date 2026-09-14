const REFRESH_INTERVAL_MS = 30_000;
const LAST_STOP_STORAGE_KEY = 'busya:lastStopId';
const LAST_NETWORK_STORAGE_KEY = 'busya:lastNetwork';
const FAVORITES_STORAGE_KEY = 'busya:favorites';
const FAVORITE_LINES_STORAGE_KEY = 'busya:favoriteLines';
const NETWORK_LABELS = { emt: 'EMT', crtm: 'Interurbano' };
// Solo para el badge de red en las tarjetas de favoritos: ahí "CRTM" es más compacto que
// "Interurbano" y ya lo reconoce quien mira esa lista. El toggle del buscador y los mensajes
// de error siguen diciendo "Interurbano", más claro para quien no sepa qué es CRTM.
const FAVORITE_NETWORK_LABELS = { emt: 'EMT', crtm: 'CRTM' };

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
const helpOpenBtn = document.getElementById('help-open');
const helpCloseBtn = document.getElementById('help-close');
const helpOverlay = document.getElementById('help-overlay');
const favoritesOpenBtn = document.getElementById('favorites-open');
const favoritesCloseBtn = document.getElementById('favorites-close');
const favoritesOverlay = document.getElementById('favorites-overlay');
const favoritesManageListEl = document.getElementById('favorites-manage-list');
const favoritesEmptyEl = document.getElementById('favorites-empty');
const networkToggleBtns = document.querySelectorAll('.network-toggle__btn');

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

networkToggleBtns.forEach((btn) => {
  btn.addEventListener('click', () => setNetwork(btn.dataset.network));
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

function openHelp() {
  helpOverlay.hidden = false;
  lockBodyScroll();
}

function closeHelp() {
  if (helpOverlay.hidden) return;
  helpOverlay.hidden = true;
  unlockBodyScroll();
}

function openFavorites() {
  renderFavoritesManageList();
  favoritesOverlay.hidden = false;
  lockBodyScroll();
}

function closeFavorites() {
  if (favoritesOverlay.hidden) return;
  favoritesOverlay.hidden = true;
  unlockBodyScroll();
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

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeHelp();
  closeFavorites();
});

function setNetwork(network) {
  currentNetwork = network;
  networkToggleBtns.forEach((btn) => {
    const active = btn.dataset.network === network;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  stopInput.placeholder = network === 'crtm' ? 'Ej. 06002' : 'Ej. 72';
  searchBtn.classList.toggle('network-emt', network === 'emt');
}

function searchStop(stopId, network = currentNetwork) {
  setNetwork(network);
  currentStopId = stopId;
  localStorage.setItem(LAST_STOP_STORAGE_KEY, stopId);
  localStorage.setItem(LAST_NETWORK_STORAGE_KEY, network);
  fetchArrivals(stopId, network, true);
  // El fallback de horario/frecuencia es una pieza propia de EMT (ver ensureStopSchedule):
  // CRTM ya da siempre una hora de paso utilizable, incluido el hueco nocturno, así que no
  // hace falta nada parecido para esa red.
  if (network === 'emt') ensureStopSchedule(stopId);
  startAutoRefresh();
}

// Se pide una sola vez por parada (no en cada refresco): el horario/frecuencia por línea
// apenas cambia, así que no tiene sentido volver a pedirlo cada 30s como los tiempos de paso.
async function ensureStopSchedule(stopId) {
  if (stopScheduleStopId === stopId) return;

  try {
    const res = await fetch(`/api/emt-stop-detail?stopId=${encodeURIComponent(stopId)}`);
    const payload = await res.json();
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
  favoriteBtn.textContent = active ? '♥' : '♡';
  favoriteBtn.classList.toggle('active', Boolean(active));
  favoriteBtn.title = active ? 'Quitar de favoritos' : 'Guardar como favorita';
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
  upBtn.textContent = '↑';
  upBtn.setAttribute('aria-label', 'Subir en la lista');
  upBtn.disabled = index === 0;
  upBtn.addEventListener('click', () => moveFavorite(index, -1));

  const downBtn = document.createElement('button');
  downBtn.type = 'button';
  downBtn.className = 'help-btn';
  downBtn.textContent = '↓';
  downBtn.setAttribute('aria-label', 'Bajar en la lista');
  downBtn.disabled = index === total - 1;
  downBtn.addEventListener('click', () => moveFavorite(index, 1));

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'help-btn';
  removeBtn.textContent = '×';
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
  card.append(header, meta);
  return card;
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (currentStopId) fetchArrivals(currentStopId, currentNetwork);
  }, REFRESH_INTERVAL_MS);
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
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.error || `Error ${res.status}`);
    }

    if (payload.code && payload.code !== '00') {
      // Confirmado en producción con la parada 3351: EMT usa un code de error con
      // description "No estimations found" para una parada real que simplemente no tiene
      // tiempos ahora mismo — no para una parada inválida. Otras apps de EMT lo tratan como
      // un estado normal (sin buses ahora), no como fallo, así que aquí también.
      if (network === 'emt' && /no estimations found/i.test(payload.description || '')) {
        renderArrivals({ stopName: null, arrivals: [] }, network);
        return;
      }
      throw new Error(payload.description || `La API de ${NETWORK_LABELS[network]} devolvió un error`);
    }

    const normalized = network === 'crtm' ? normalizeCrtm(payload) : normalizeEmt(payload);

    renderArrivals(normalized, network);
  } catch (err) {
    // isFirstLoad (nada en pantalla aún) o isExplicitSearch (el usuario pidió justo esta
    // parada, aunque hubiera resultados de otra parada anterior todavía visibles) siempre
    // muestran el error. Solo el refresco automático en segundo plano de la MISMA parada se
    // traga fallos puntuales en silencio, para no tapar datos buenos por un hipo pasajero.
    if (isFirstLoad || isExplicitSearch) {
      showStatus(`No se pudo obtener la parada ${stopId}: ${err.message}`, 'error');
      resultsEl.hidden = true;
    } else {
      console.error(`Refresco de la parada ${stopId} falló:`, err.message);
    }
  }
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

  lastUpdatedEl.textContent = `Actualizado ${formatTime(new Date())}`;
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
  if (network === 'crtm') {
    // Aproximada (línea recta entre las coordenadas del bus y de la parada, calculada en
    // el proxy) — CRTM no da la distancia real sobre la ruta como sí hace EMT. El "~" dejar
    // claro que no es exacta. Vacía cuando no hay ningún vehículo circulando ya en esa
    // línea/sentido.
    const formatted = formatDistance(arrival.distanceMeters);
    distance.textContent = formatted ? `~${formatted}` : '';
  } else if (hasReliableEta(arrival.estimateArrive, network)) {
    // Sin ETA fiable no hay posición real del bus; DistanceBus no es un dato útil en ese caso.
    distance.textContent = formatDistance(arrival.DistanceBus);
  } else {
    distance.textContent = formatScheduleFallback(arrival.line);
  }

  li.append(line, destination, eta, distance);
  return li;
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
  if (typeof seconds !== 'number') return false;
  if (network === 'crtm') return true;
  return seconds <= MAX_RELIABLE_ETA_SECONDS;
}

function formatEta(seconds, network) {
  if (!hasReliableEta(seconds, network)) return 'Sin estimación';
  if (seconds < 60) return 'Llegando';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
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

// Recupera la última parada (y red) consultada para no partir de cero.
setNetwork(localStorage.getItem(LAST_NETWORK_STORAGE_KEY) || 'emt');
const lastStopId = localStorage.getItem(LAST_STOP_STORAGE_KEY);
if (lastStopId) {
  stopInput.value = lastStopId;
  searchStop(lastStopId, currentNetwork);
}

// Cachea el shell de la app (ver sw.js) para que la PWA instalada cargue al instante y
// funcione sin conexión. Si el registro falla (p.ej. servido por HTTP en algún entorno
// local) no es grave: se registra en consola y ya está, la app sigue funcionando igual.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.error('SW registration failed', err));
  });

  // sw.js llama a skipWaiting()/clients.claim(), así que una versión nueva toma el control
  // de una pestaña ya abierta de inmediato — pero esa pestaña sigue con el html/css/js
  // antiguo ya cargado en memoria hasta que se recarga. "controllerchange" se dispara justo
  // en ese momento, así que se recarga una vez para coger el shell nuevo; si no, una PWA
  // dejada abierta un tiempo seguiría corriendo código viejo sin enterarse. Con guarda para
  // no disparar dos veces, ya que el evento en teoría puede repetirse.
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    window.location.reload();
  });

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

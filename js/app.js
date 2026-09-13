const REFRESH_INTERVAL_MS = 30_000;
const LAST_STOP_STORAGE_KEY = 'busya:lastStopId';
const FAVORITES_STORAGE_KEY = 'busya:favorites';

const form = document.getElementById('stop-form');
const stopInput = document.getElementById('stop-id');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const stopNameEl = document.getElementById('stop-name');
const lastUpdatedEl = document.getElementById('last-updated');
const arrivalsListEl = document.getElementById('arrivals-list');
const refreshBtn = document.getElementById('refresh-btn');
const favoriteBtn = document.getElementById('favorite-btn');
const favoritesListEl = document.getElementById('favorites-list');
const helpOpenBtn = document.getElementById('help-open');
const helpCloseBtn = document.getElementById('help-close');
const helpOverlay = document.getElementById('help-overlay');

let refreshTimer = null;
let currentStopId = null;
let currentStopName = null;

// Horario/frecuencia por línea de la última parada consultada (fallback cuando no hay
// tiempo real fiable). A diferencia de los tiempos de paso, esto casi no cambia, así que
// se pide una sola vez por parada, no en cada refresco de 30s.
let stopSchedule = null; // Map<línea, {startTime, stopTime, minFreq, maxFreq}>
let stopScheduleStopId = null;

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const stopId = stopInput.value.trim();
  if (!stopId) return;
  searchStop(stopId);
});

refreshBtn.addEventListener('click', () => {
  if (currentStopId) fetchArrivals(currentStopId);
});

favoriteBtn.addEventListener('click', () => {
  if (!currentStopId) return;
  toggleFavorite(currentStopId, currentStopName);
  updateFavoriteBtn();
  renderFavoritesList();
});

favoritesListEl.addEventListener('click', (event) => {
  const removeBtn = event.target.closest('.favorite-chip__remove');
  if (removeBtn) {
    event.stopPropagation();
    removeFavorite(removeBtn.closest('.favorite-chip').dataset.stopId);
    renderFavoritesList();
    updateFavoriteBtn();
    return;
  }
  const chip = event.target.closest('.favorite-chip');
  if (chip) {
    stopInput.value = chip.dataset.stopId;
    searchStop(chip.dataset.stopId);
  }
});

helpOpenBtn.addEventListener('click', () => { helpOverlay.hidden = false; });
helpCloseBtn.addEventListener('click', () => { helpOverlay.hidden = true; });
helpOverlay.addEventListener('click', (event) => {
  if (event.target === helpOverlay) helpOverlay.hidden = true;
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !helpOverlay.hidden) helpOverlay.hidden = true;
});

function searchStop(stopId) {
  currentStopId = stopId;
  localStorage.setItem(LAST_STOP_STORAGE_KEY, stopId);
  fetchArrivals(stopId);
  ensureStopSchedule(stopId);
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
    if (currentStopId === stopId && !resultsEl.hidden) {
      fetchArrivals(stopId);
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

function isFavorite(stopId) {
  return getFavorites().some((fav) => fav.stopId === stopId);
}

function toggleFavorite(stopId, stopName) {
  const favorites = getFavorites();
  const index = favorites.findIndex((fav) => fav.stopId === stopId);
  if (index >= 0) {
    favorites.splice(index, 1);
  } else {
    favorites.push({ stopId, name: stopName || null });
  }
  saveFavorites(favorites);
}

function removeFavorite(stopId) {
  saveFavorites(getFavorites().filter((fav) => fav.stopId !== stopId));
}

function updateFavoriteBtn() {
  const active = currentStopId && isFavorite(currentStopId);
  favoriteBtn.textContent = active ? '♥' : '♡';
  favoriteBtn.classList.toggle('active', Boolean(active));
  favoriteBtn.title = active ? 'Quitar de favoritos' : 'Guardar como favorita';
}

function renderFavoritesList() {
  const favorites = getFavorites();
  favoritesListEl.innerHTML = '';
  favoritesListEl.hidden = favorites.length === 0;

  for (const fav of favorites) {
    const li = document.createElement('li');
    li.className = 'favorite-chip';
    li.dataset.stopId = fav.stopId;

    const label = document.createElement('span');
    label.textContent = fav.name ? `${fav.name}` : `Parada ${fav.stopId}`;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'favorite-chip__remove';
    remove.setAttribute('aria-label', `Quitar ${fav.name || fav.stopId} de favoritos`);
    remove.textContent = '×';

    li.append(label, remove);
    favoritesListEl.appendChild(li);
  }
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (currentStopId) fetchArrivals(currentStopId);
  }, REFRESH_INTERVAL_MS);
}

async function fetchArrivals(stopId) {
  showStatus('Buscando parada…', 'loading');

  try {
    const res = await fetch(`/api/emt-arrives?stopId=${encodeURIComponent(stopId)}`);
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.error || `Error ${res.status}`);
    }

    if (payload.code && payload.code !== '00') {
      throw new Error(payload.description || 'La API de EMT devolvió un error');
    }

    renderArrivals(payload);
  } catch (err) {
    showStatus(`No se pudo obtener la parada ${stopId}: ${err.message}`, 'error');
    resultsEl.hidden = true;
  }
}

function renderArrivals(payload) {
  const stopData = payload.data?.[0];
  if (!stopData) {
    showStatus('La API no devolvió datos para esta parada.', 'error');
    resultsEl.hidden = true;
    return;
  }

  const stopInfo = stopData.StopInfo?.[0];
  const arrivals = stopData.Arrive ?? [];

  currentStopName = stopInfo?.stopName || null;
  stopNameEl.textContent = currentStopName
    ? `${currentStopName} (parada ${currentStopId})`
    : `Parada ${currentStopId}`;

  // Si esta parada ya estaba en favoritos sin nombre (se guardó antes de tener este dato),
  // se completa en silencio la próxima vez que se consulta.
  if (currentStopName && isFavorite(currentStopId)) {
    const favorites = getFavorites();
    const fav = favorites.find((f) => f.stopId === currentStopId);
    if (fav && !fav.name) {
      fav.name = currentStopName;
      saveFavorites(favorites);
      renderFavoritesList();
    }
  }

  updateFavoriteBtn();

  arrivalsListEl.innerHTML = '';

  if (arrivals.length === 0) {
    const li = document.createElement('li');
    li.className = 'arrivals-list__empty';
    li.textContent = 'No hay buses en camino ahora mismo.';
    arrivalsListEl.appendChild(li);
  } else {
    const sorted = [...arrivals].sort((a, b) => a.estimateArrive - b.estimateArrive);
    for (const arrival of sorted) {
      arrivalsListEl.appendChild(renderArrivalItem(arrival));
    }
  }

  lastUpdatedEl.textContent = `Actualizado ${formatTime(new Date())}`;
  hideStatus();
  resultsEl.hidden = false;
}

function renderArrivalItem(arrival) {
  const li = document.createElement('li');
  li.className = 'arrival-item';

  const line = document.createElement('span');
  line.className = 'arrival-item__line';
  line.textContent = arrival.line;

  const destination = document.createElement('span');
  destination.className = 'arrival-item__destination';
  destination.textContent = arrival.destination;

  const eta = document.createElement('span');
  eta.className = `arrival-item__eta ${etaClass(arrival.estimateArrive)}`;
  eta.textContent = formatEta(arrival.estimateArrive);

  const distance = document.createElement('span');
  distance.className = 'arrival-item__distance';
  if (hasReliableEta(arrival.estimateArrive)) {
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
const MAX_RELIABLE_ETA_SECONDS = 90 * 60;

function hasReliableEta(seconds) {
  return typeof seconds === 'number' && seconds <= MAX_RELIABLE_ETA_SECONDS;
}

function formatEta(seconds) {
  if (!hasReliableEta(seconds)) return 'Sin estimación';
  if (seconds < 60) return 'Llegando';
  return `${Math.round(seconds / 60)} min`;
}

function etaClass(seconds) {
  if (!hasReliableEta(seconds)) return 'eta-unknown';
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

renderFavoritesList();

// Recupera la última parada consultada para no partir de cero.
const lastStopId = localStorage.getItem(LAST_STOP_STORAGE_KEY);
if (lastStopId) {
  stopInput.value = lastStopId;
  searchStop(lastStopId);
}

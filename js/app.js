const REFRESH_INTERVAL_MS = 30_000;
const LAST_STOP_STORAGE_KEY = 'busya:lastStopId';

const form = document.getElementById('stop-form');
const stopInput = document.getElementById('stop-id');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const stopNameEl = document.getElementById('stop-name');
const lastUpdatedEl = document.getElementById('last-updated');
const arrivalsListEl = document.getElementById('arrivals-list');
const refreshBtn = document.getElementById('refresh-btn');

let refreshTimer = null;
let currentStopId = null;

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const stopId = stopInput.value.trim();
  if (!stopId) return;
  searchStop(stopId);
});

refreshBtn.addEventListener('click', () => {
  if (currentStopId) fetchArrivals(currentStopId);
});

function searchStop(stopId) {
  currentStopId = stopId;
  localStorage.setItem(LAST_STOP_STORAGE_KEY, stopId);
  fetchArrivals(stopId);
  startAutoRefresh();
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

  stopNameEl.textContent = stopInfo?.stopName
    ? `${stopInfo.stopName} (parada ${currentStopId})`
    : `Parada ${currentStopId}`;

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
  // Con estimateArrive >= 999999 EMT no da posición real del bus; DistanceBus llega a 0 y no es dato útil.
  distance.textContent = arrival.estimateArrive >= 999_999 ? '' : formatDistance(arrival.DistanceBus);

  li.append(line, destination, eta, distance);
  return li;
}

function formatEta(seconds) {
  if (seconds >= 999_999) return '> 45 min';
  if (seconds < 60) return 'Llegando';
  return `${Math.round(seconds / 60)} min`;
}

function etaClass(seconds) {
  if (seconds >= 999_999) return 'eta-unknown';
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

// Recupera la última parada consultada para no partir de cero.
const lastStopId = localStorage.getItem(LAST_STOP_STORAGE_KEY);
if (lastStopId) {
  stopInput.value = lastStopId;
  searchStop(lastStopId);
}

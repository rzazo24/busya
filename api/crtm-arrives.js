// api/crtm-arrives.js
// Función serverless de Vercel (Node.js runtime).
// Uso desde el frontend: GET /api/crtm-arrives?stopId=06002
//
// Proxy a la API pública de widgets de CRTM (buses interurbanos de la Comunidad de Madrid).
// No requiere credenciales — a diferencia de EMT, esta API es pública — pero no manda
// cabeceras CORS, así que un fetch directo desde el navegador falla; este proxy solo existe
// para saltar esa restricción, no para esconder ningún secreto.

import { haversineMeters } from '../lib/geo.js';

const CRTM_BASE = 'https://www.crtm.es/widgets/api';

// 8 = "AUTOBUSES INTERURBANOS" en GetModes.php de CRTM (4=Metro, 5=Cercanías, 6=EMT,
// 9=urbanos de otros municipios, 10=Metro Ligero/Tranvía). Verificado contra la API real.
const INTERURBAN_MODE = '8';

// Probado en vivo: la mayoría de las llamadas a CRTM tardan 300-900ms, pero de vez en cuando
// una se cuelga varios segundos (una vez, 21s en total para una sola búsqueda). Sin límite,
// una sola llamada colgada arrastra todo el Promise.all y puede superar los 10s de
// maxDuration de la función en Vercel, tirando abajo una búsqueda que por lo demás iba bien.
// Con esto, esa llamada concreta simplemente no da distancia (igual que "sin bus circulando")
// en vez de romper toda la respuesta.
const FETCH_TIMEOUT_MS = 2500;

function fetchWithTimeout(url) {
  return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

function buildCodStop(stopId) {
  // Los ceros a la izquierda son parte del identificador real, no relleno cosmético
  // (probado en vivo: codStop=8_6002 devuelve error, 8_06002 funciona) — se usa el número
  // tal cual lo escribe el usuario, asumiendo que coincide con lo impreso en el poste.
  return `${INTERURBAN_MODE}_${stopId}`;
}

// CRTM no da distancia del bus junto a los tiempos de paso (a diferencia de EMT). Sí existe
// un endpoint de posición en vivo (GetLineLocation.php), pero por línea+sentido, no por
// parada — probado en vivo: para mostrarla hay que 1) sacar las coordenadas de la parada,
// 2) por cada combinación única de línea+sentido de los resultados, buscar su itinerario y
// preguntar la posición del vehículo, todo en paralelo. Es una distancia en línea recta
// (solo hay coordenadas de bus y de parada, no la ruta real), así que se queda corta en
// carreteras con curvas — más aproximada que el DistanceBus real de EMT.
async function fetchStopCoordinates(codStop) {
  try {
    const res = await fetchWithTimeout(`${CRTM_BASE}/GetStops.php?codStop=${encodeURIComponent(codStop)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const stop = data.stops?.Stop;
    const stopObj = Array.isArray(stop) ? stop[0] : stop;
    return stopObj?.coordinates ?? null;
  } catch {
    return null;
  }
}

async function fetchItineraryCode(codLine, direction) {
  const res = await fetchWithTimeout(
    `${CRTM_BASE}/GetLinesInformation.php?activeItinerary=1&codLine=${encodeURIComponent(codLine)}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const itineraries = data.lines?.LineInformation?.itinerary?.Itinerary;
  const list = Array.isArray(itineraries) ? itineraries : itineraries ? [itineraries] : [];
  // Si ningún itinerario declara el mismo sentido que el de la llegada, mejor una posición
  // aproximada (el primer itinerario que haya) que ninguna.
  const match = list.find((it) => Number(it.direction) === Number(direction));
  return match?.codItinerary ?? list[0]?.codItinerary ?? null;
}

async function fetchVehicleDistanceMeters(codLine, direction, codStop, stopCoords) {
  if (!stopCoords) return null;
  try {
    const codItinerary = await fetchItineraryCode(codLine, direction);
    if (!codItinerary) return null;

    const url =
      `${CRTM_BASE}/GetLineLocation.php?mode=${INTERURBAN_MODE}&codItinerary=${encodeURIComponent(codItinerary)}` +
      `&codLine=${encodeURIComponent(codLine)}&codStop=${encodeURIComponent(codStop)}&direction=${direction}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;

    const data = await res.json();
    const located = data.vehiclesLocation?.VehicleLocation;
    const vehicle = Array.isArray(located) ? located[0] : located;
    if (!vehicle?.coordinates) return null; // línea sin ningún bus circulando ahora mismo

    return haversineMeters(stopCoords, vehicle.coordinates);
  } catch {
    return null;
  }
}

// Una entrada por cada combinación única (codLine, direction) que aparezca en los
// resultados — varias llegadas de la misma línea/sentido comparten la misma búsqueda de
// posición, no hace falta repetirla.
async function fetchDistancesByLine(timesList, codStop, stopCoords) {
  const uniquePairs = [
    ...new Map(
      timesList
        .filter((t) => t.line?.codLine)
        .map((t) => [`${t.line.codLine}|${t.direction}`, { codLine: t.line.codLine, direction: t.direction }])
    ).values(),
  ];

  const entries = await Promise.all(
    uniquePairs.map(async ({ codLine, direction }) => [
      `${codLine}|${direction}`,
      await fetchVehicleDistanceMeters(codLine, direction, codStop, stopCoords),
    ])
  );

  return new Map(entries);
}

export default async function handler(req, res) {
  const { stopId } = req.query;

  if (!stopId || !/^\d+$/.test(stopId)) {
    return res.status(400).json({ error: 'Falta o es inválido el parámetro stopId (debe ser numérico)' });
  }

  try {
    const codStop = buildCodStop(stopId);
    const url = `${CRTM_BASE}/GetStopsTimes.php?codStop=${encodeURIComponent(codStop)}&type=0&orderBy=2&stopTimesByIti=`;

    // Las coordenadas de la parada no dependen en nada del resultado de GetStopsTimes (solo
    // hace falta el codStop, que ya se tiene) — se piden en paralelo en vez de encadenadas,
    // para no sumar su latencia a la del resto de llamadas (itinerario + posición) de abajo.
    const [crtmRes, stopCoords] = await Promise.all([fetchWithTimeout(url), fetchStopCoordinates(codStop)]);

    if (!crtmRes.ok) {
      throw new Error(`CRTM respondió con status ${crtmRes.status}`);
    }

    const data = await crtmRes.json();
    if (data.error) {
      throw new Error(data.message || 'La API de CRTM devolvió un error');
    }

    const stopTimes = data.stopTimes;
    if (!stopTimes) {
      throw new Error('Respuesta inesperada de CRTM');
    }

    // CRTM da una hora absoluta de paso, no segundos restantes como EMT — se calcula aquí,
    // contra la propia hora del servidor de CRTM (actualDate) y no la del usuario, para no
    // depender de que el reloj del navegador esté bien puesto.
    const now = new Date(stopTimes.actualDate).getTime();

    // Igual que en las respuestas de EMT/CRTM ya vistas: con un solo resultado, el campo
    // llega como objeto suelto en vez de array de un elemento — hay que contemplar ambos casos.
    const rawTimes = stopTimes.times?.Time;
    const timesList = Array.isArray(rawTimes) ? rawTimes : rawTimes ? [rawTimes] : [];

    const distanceByLine = await fetchDistancesByLine(timesList, codStop, stopCoords);

    const arrivals = timesList.map((t) => ({
      line: t.line?.shortDescription ?? '',
      destination: t.destination ?? '',
      estimateArrive: Math.max(0, Math.round((new Date(t.time).getTime() - now) / 1000)),
      distanceMeters: distanceByLine.get(`${t.line?.codLine}|${t.direction}`) ?? null,
    }));

    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
    return res.status(200).json({
      code: '00',
      stopName: stopTimes.stop?.name ?? null,
      arrivals,
    });
  } catch (err) {
    console.error('Error en crtm-arrives:', err.message);
    return res.status(502).json({ error: 'No se pudo obtener información de CRTM', detail: err.message });
  }
}

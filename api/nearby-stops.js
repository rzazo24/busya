// api/nearby-stops.js
// Función serverless de Vercel (Node.js runtime).
// Uso desde el frontend: GET /api/nearby-stops?lat=<lat>&lon=<lon>
//
// Paradas de EMT e Interurbano más cercanas a una coordenada. Usa el propio agregador de
// CRTM (GetNearestStopsByLocation.php), que también indexa las paradas de EMT (prefijo de
// codStop "6_") — así no hace falta buscar ni montar un endpoint de geolocalización propio
// de EMT, que no lo expone en su OpenAPI pública.
//
// Ese endpoint no filtra por red: con mode= vacío devuelve Metro/Cercanías/EMT/Interurbano
// mezclados, con una fila repetida por cada línea que pasa por cada parada (probado en vivo:
// 193 filas para solo 53 paradas distintas a 500m en una zona con mucho tráfico). Aquí se
// filtra a solo EMT/Interurbano y se deduplica por codStop. El campo "codMode" a nivel de
// parada no es de fiar (visto en vivo no coincidiendo con el prefijo numérico de su propio
// codStop) — el prefijo de codStop sí, es el mismo criterio ya usado en crtm-arrives.js.
// Tampoco da distancia: se calcula aquí con la misma fórmula que la distancia aproximada del
// bus en crtm-arrives.js (lib/geo.js).

import { haversineMeters } from '../lib/geo.js';

const CRTM_BASE = 'https://www.crtm.es/widgets/api';

// Probado en vivo: la latencia de este endpoint concreto es muy irregular incluso a radio
// corto (300m fue de 1.7s a 6.6s según el momento, 400m llegó a tardar 8.6s en la misma
// zona, sin relación clara con el radio). Más margen que el FETCH_TIMEOUT_MS de
// crtm-arrives.js porque esto es una búsqueda puntual a demanda, no algo que se repita cada
// 30s — 8.5s deja algo de margen bajo el maxDuration:10 de esta función en vercel.json.
const FETCH_TIMEOUT_MS = 8500;

// Radio de búsqueda en metros. Probado en vivo: de sobra incluso en una zona muy densa
// (27 paradas EMT/Interurbano distintas en Plaza de Castilla) y es el radio más grande que
// respondió con latencia consistentemente baja en las pruebas.
const SEARCH_RADIUS_METERS = 300;

const MAX_RESULTS = 8;

// El prefijo numérico del propio codStop (p.ej. "6_28" -> "6"), no el campo "codMode" de la
// parada — ver nota de arriba. Solo se incluyen las dos redes que soporta esta app.
const NETWORK_BY_CODSTOP_PREFIX = { 6: 'emt', 8: 'crtm' };

function fetchWithTimeout(url) {
  return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

export default async function handler(req, res) {
  const { lat: rawLat, lon: rawLon } = req.query;
  // Number(null) da 0 (una coordenada real, el golfo de Guinea) en vez de NaN — hay que
  // rechazar el valor en bruto que falta antes de convertirlo, no solo el resultado.
  const lat = Number(rawLat);
  const lon = Number(rawLon);

  if (!rawLat || !rawLon || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'Faltan o son inválidos los parámetros lat/lon' });
  }

  try {
    const url =
      `${CRTM_BASE}/GetNearestStopsByLocation.php?latitude=${lat}&longitude=${lon}` +
      `&mode=&method=1&precision=${SEARCH_RADIUS_METERS}`;
    const crtmRes = await fetchWithTimeout(url);

    if (!crtmRes.ok) {
      throw new Error(`CRTM respondió con status ${crtmRes.status}`);
    }

    const data = await crtmRes.json();
    if (data.error) {
      throw new Error(data.message || 'La API de CRTM devolvió un error');
    }

    // Igual que en crtm-arrives.js: con un solo resultado, el campo llega como objeto suelto
    // en vez de array de un elemento.
    const rawStops = data.stops?.Stop;
    const stopsList = Array.isArray(rawStops) ? rawStops : rawStops ? [rawStops] : [];

    const byStopId = new Map();
    for (const stop of stopsList) {
      const network = NETWORK_BY_CODSTOP_PREFIX[stop.codStop?.split('_')[0]];
      if (!network || !stop.coordinates || byStopId.has(stop.codStop)) continue;

      const rawLines = stop.lines?.Line;
      const linesList = Array.isArray(rawLines) ? rawLines : rawLines ? [rawLines] : [];

      byStopId.set(stop.codStop, {
        stopId: stop.shortCodStop,
        network,
        name: stop.name || null,
        distanceMeters: haversineMeters({ latitude: lat, longitude: lon }, stop.coordinates),
        lines: [...new Set(linesList.map((line) => line.shortDescription).filter(Boolean))],
      });
    }

    const stops = [...byStopId.values()]
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, MAX_RESULTS);

    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
    return res.status(200).json({ stops });
  } catch (err) {
    console.error('Error en nearby-stops:', err.message);
    return res.status(502).json({ error: 'No se pudieron buscar paradas cercanas', detail: err.message });
  }
}

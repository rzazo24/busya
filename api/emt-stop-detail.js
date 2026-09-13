// api/emt-stop-detail.js
// Función serverless de Vercel (Node.js runtime).
// Uso desde el frontend: GET /api/emt-stop-detail?stopId=123
//
// Da, por cada línea que pasa por la parada, su horario de servicio y frecuencia media
// (startTime/stopTime/minFreq/maxFreq). Se usa como fallback en el frontend cuando
// /api/emt-arrives no tiene una estimación de tiempo real fiable para una línea (p. ej.
// líneas nocturnas sin GPS). A diferencia de /arrives/, este dato apenas cambia, así que
// se cachea agresivamente aquí y el frontend lo pide una sola vez por parada, no en cada
// refresco de 30s.

import { getValidToken, login } from '../lib/emt-client.js';

const STOP_DETAIL_URL_BASE = 'https://openapi.emtmadrid.es/v2/transport/busemtmad/stops';

function fetchStopDetail(stopId, token) {
  return fetch(`${STOP_DETAIL_URL_BASE}/${stopId}/detail/`, {
    method: 'GET',
    headers: {
      accessToken: token,
    },
  });
}

export default async function handler(req, res) {
  const { stopId } = req.query;

  if (!stopId || !/^\d+$/.test(stopId)) {
    return res.status(400).json({ error: 'Falta o es inválido el parámetro stopId (debe ser numérico)' });
  }

  try {
    let token = await getValidToken();
    let detailRes = await fetchStopDetail(stopId, token);

    if (detailRes.status === 401) {
      token = await login();
      detailRes = await fetchStopDetail(stopId, token);
    }

    if (!detailRes.ok) {
      throw new Error(`EMT stop detail falló con status ${detailRes.status}`);
    }

    const detailData = await detailRes.json();

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(detailData);
  } catch (err) {
    console.error('Error en emt-stop-detail:', err.message);
    return res.status(502).json({ error: 'No se pudo obtener el detalle de la parada de EMT', detail: err.message });
  }
}

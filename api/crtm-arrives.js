// api/crtm-arrives.js
// Función serverless de Vercel (Node.js runtime).
// Uso desde el frontend: GET /api/crtm-arrives?stopId=06002
//
// Proxy a la API pública de widgets de CRTM (buses interurbanos de la Comunidad de Madrid).
// No requiere credenciales — a diferencia de EMT, esta API es pública — pero no manda
// cabeceras CORS, así que un fetch directo desde el navegador falla; este proxy solo existe
// para saltar esa restricción, no para esconder ningún secreto.

const CRTM_BASE = 'https://www.crtm.es/widgets/api';

// 8 = "AUTOBUSES INTERURBANOS" en GetModes.php de CRTM (4=Metro, 5=Cercanías, 6=EMT,
// 9=urbanos de otros municipios, 10=Metro Ligero/Tranvía). Verificado contra la API real.
const INTERURBAN_MODE = '8';

function buildCodStop(stopId) {
  // Los ceros a la izquierda son parte del identificador real, no relleno cosmético
  // (probado en vivo: codStop=8_6002 devuelve error, 8_06002 funciona) — se usa el número
  // tal cual lo escribe el usuario, asumiendo que coincide con lo impreso en el poste.
  return `${INTERURBAN_MODE}_${stopId}`;
}

export default async function handler(req, res) {
  const { stopId } = req.query;

  if (!stopId || !/^\d+$/.test(stopId)) {
    return res.status(400).json({ error: 'Falta o es inválido el parámetro stopId (debe ser numérico)' });
  }

  try {
    const codStop = buildCodStop(stopId);
    const url = `${CRTM_BASE}/GetStopsTimes.php?codStop=${encodeURIComponent(codStop)}&type=0&orderBy=2&stopTimesByIti=`;

    const crtmRes = await fetch(url);
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

    const arrivals = timesList.map((t) => ({
      line: t.line?.shortDescription ?? '',
      destination: t.destination ?? '',
      estimateArrive: Math.max(0, Math.round((new Date(t.time).getTime() - now) / 1000)),
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

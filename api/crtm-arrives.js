// api/crtm-arrives.js
// Función serverless de Vercel (Node.js runtime).
// Uso desde el frontend: GET /api/crtm-arrives?stopId=06002
//
// Proxy a la API pública de widgets de CRTM (buses interurbanos de la Comunidad de Madrid).
// No requiere credenciales — a diferencia de EMT, esta API es pública — pero no manda
// cabeceras CORS, así que un fetch directo desde el navegador falla; este proxy solo existe
// para saltar esa restricción, no para esconder ningún secreto.
//
// No calcula distancia del bus (a diferencia de EMT, que la da directa en su propia API):
// se intentó aproximarla en línea recta a partir de la posición en vivo de GetLineLocation.php,
// pero CRTM no da ninguna forma fiable de saber qué vehículo concreto corresponde a qué hora
// programada cuando hay varios circulando en la misma línea+sentido — tras varios intentos de
// arreglarlo (la misma distancia se repetía entre llegadas, o salían valores físicamente
// imposibles como un bus "llegando" ya a varios km), se quitó por completo: es mejor no
// mostrar nada que un dato erróneo la mayoría de las veces.

const CRTM_BASE = 'https://www.crtm.es/widgets/api';

// 8 = "AUTOBUSES INTERURBANOS" en GetModes.php de CRTM (4=Metro, 5=Cercanías, 6=EMT,
// 9=urbanos de otros municipios, 10=Metro Ligero/Tranvía). Verificado contra la API real.
const INTERURBAN_MODE = '8';

// Probado en vivo: GetStopsTimes tarda 300-900ms la mayoría de las veces, pero de vez en
// cuando se cuelga varios segundos (una vez, 21s). 5s deja margen de sobra bajo el
// maxDuration:10 de vercel.json sin arriesgar timeouts en el caso normal.
const FETCH_TIMEOUT_MS = 5000;

function fetchWithTimeout(url) {
  return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

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
    const crtmRes = await fetchWithTimeout(url);

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
    // depender de que el reloj del navegador esté bien puesto. Si actualDate faltara o no
    // fuera parseable, Date.parse daría NaN y TODAS las llegadas saldrían sin estimación de
    // golpe (ver más abajo) — se usa el reloj del propio servidor como respaldo en ese caso.
    const parsedNow = Date.parse(stopTimes.actualDate);
    const now = Number.isFinite(parsedNow) ? parsedNow : Date.now();

    // Igual que en las respuestas de EMT/CRTM ya vistas: con un solo resultado, el campo
    // llega como objeto suelto en vez de array de un elemento — hay que contemplar ambos casos.
    const rawTimes = stopTimes.times?.Time;
    const timesList = Array.isArray(rawTimes) ? rawTimes : rawTimes ? [rawTimes] : [];

    const arrivals = timesList.map((t) => {
      const parsedTime = Date.parse(t.time);
      // Si el "time" de esta llegada en concreto no fuera parseable, se deja sin estimación
      // (null, igual que hasReliableEta ya trata cualquier valor no numérico) en vez de
      // quitar la línea entera de la lista — sigue siendo información real de que esa línea
      // pasa por esta parada, aunque no se sepa cuándo.
      const estimateArrive = Number.isFinite(parsedTime) ? Math.max(0, Math.round((parsedTime - now) / 1000)) : null;
      return {
        line: t.line?.shortDescription ?? '',
        destination: t.destination ?? '',
        estimateArrive,
      };
    });

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

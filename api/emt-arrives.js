// api/emt-arrives.js
// Función serverless de Vercel (Node.js runtime).
// Uso desde el frontend: GET /api/emt-arrives?stopId=123

const LOGIN_URL = 'https://openapi.emtmadrid.es/v1/mobilitylabs/user/login/';
const ARRIVES_URL_BASE = 'https://openapi.emtmadrid.es/v2/transport/busemtmad/stops';

// Cache en memoria del token, válido mientras la función esté "caliente".
// Si Vercel arranca una instancia nueva, se pedirá un token nuevo automáticamente.
let cachedToken = null;
let tokenExpiresAt = 0; // timestamp en ms

async function login() {
  const email = process.env.EMT_EMAIL;
  const password = process.env.EMT_PASSWORD;

  if (!email || !password) {
    throw new Error('Faltan las variables de entorno EMT_EMAIL o EMT_PASSWORD');
  }

  const res = await fetch(LOGIN_URL, {
    method: 'GET',
    headers: {
      email,
      password,
    },
  });

  if (!res.ok) {
    throw new Error(`Login EMT falló con status ${res.status}`);
  }

  const data = await res.json();

  // La respuesta de EMT anida el token dentro de "data[0].accessToken"
  const accessData = data?.data?.[0];
  if (!accessData?.accessToken) {
    throw new Error('Respuesta de login inesperada de EMT');
  }

  cachedToken = accessData.accessToken;

  // EMT devuelve "tokenSecExpiration": segundos de validez desde ahora (normalmente 3600),
  // no una fecha de caducidad. Si no viene, asumimos 55 minutos por seguridad.
  const secondsValid = accessData.tokenSecExpiration
    ? Number(accessData.tokenSecExpiration)
    : 55 * 60;

  tokenExpiresAt = Date.now() + secondsValid * 1000;

  return cachedToken;
}

async function getValidToken() {
  const bufferMs = 60 * 1000; // renovamos 1 minuto antes de que caduque
  if (cachedToken && Date.now() < tokenExpiresAt - bufferMs) {
    return cachedToken;
  }
  return login();
}

// Cuerpo esperado por /arrives/: el stopId va en la URL, no en el body.
// Text_EstimationsRequired_YN=Y es imprescindible: sin él la API no calcula estimateArrive.
function buildArrivesBody() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return {
    cultureInfo: 'ES',
    Text_StopRequired_YN: 'Y',
    Text_EstimationsRequired_YN: 'Y',
    Text_IncidencesRequired_YN: 'N',
    DateTime_Referenced_Incidencies_YYYYMMDD: today,
  };
}

function fetchArrives(stopId, token) {
  return fetch(`${ARRIVES_URL_BASE}/${stopId}/arrives/`, {
    method: 'POST',
    headers: {
      accessToken: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildArrivesBody()),
  });
}

export default async function handler(req, res) {
  const { stopId } = req.query;

  if (!stopId || !/^\d+$/.test(stopId)) {
    return res.status(400).json({ error: 'Falta o es inválido el parámetro stopId (debe ser numérico)' });
  }

  try {
    let token = await getValidToken();
    let arrivesRes = await fetchArrives(stopId, token);

    // Si el token ha caducado a mitad de camino, forzamos un login nuevo y reintentamos una vez.
    if (arrivesRes.status === 401) {
      token = await login();
      arrivesRes = await fetchArrives(stopId, token);
    }

    if (!arrivesRes.ok) {
      throw new Error(`EMT arrives falló con status ${arrivesRes.status}`);
    }

    const arrivesData = await arrivesRes.json();

    // Devolvemos tal cual el JSON de EMT; si quieres, aquí puedes limpiar/mapear
    // los campos antes de enviarlos al frontend.
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    return res.status(200).json(arrivesData);
  } catch (err) {
    console.error('Error en emt-arrives:', err.message);
    return res.status(502).json({ error: 'No se pudo obtener información de EMT', detail: err.message });
  }
}

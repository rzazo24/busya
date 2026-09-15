// lib/emt-client.js
// Login y caché de accessToken compartidos entre las funciones serverless de EMT
// (api/emt-arrives.js y api/emt-stop-detail.js). El caché es en memoria por instancia
// de función — cada función que importa este módulo tiene su propio caché, no se
// comparte entre funciones distintas en Vercel.
//
// Login "Protected" (X-ClientId + passKey, app registrada en MobilityLabs) en vez del
// login "Basic" (email/password de una cuenta personal): misma cuota que el nivel
// "Advanced" (250k peticiones/día frente a las 25k de Basic), sesión de hasta 86400s en
// vez de la corta que da Basic, y sin depender de la contraseña de una cuenta personal
// como secreto del servidor. Mismo endpoint y misma forma de respuesta (accessToken,
// tokenSecExpiration) — solo cambian las cabeceras de la petición.
const LOGIN_URL = 'https://openapi.emtmadrid.es/v1/mobilitylabs/user/login/';

let cachedToken = null;
let tokenExpiresAt = 0; // timestamp en ms

export async function login() {
  const clientId = process.env.EMT_CLIENT_ID;
  const passKey = process.env.EMT_PASSKEY;

  if (!clientId || !passKey) {
    throw new Error('Faltan las variables de entorno EMT_CLIENT_ID o EMT_PASSKEY');
  }

  const res = await fetch(LOGIN_URL, {
    method: 'GET',
    headers: {
      'X-ClientId': clientId,
      passKey,
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

  // EMT devuelve "tokenSecExpiration": segundos de validez desde ahora (hasta 86400 con
  // login Protected), no una fecha de caducidad. Si no viene, asumimos 55 minutos por
  // seguridad.
  const secondsValid = accessData.tokenSecExpiration
    ? Number(accessData.tokenSecExpiration)
    : 55 * 60;

  tokenExpiresAt = Date.now() + secondsValid * 1000;

  return cachedToken;
}

export async function getValidToken() {
  const bufferMs = 60 * 1000; // renovamos 1 minuto antes de que caduque
  if (cachedToken && Date.now() < tokenExpiresAt - bufferMs) {
    return cachedToken;
  }
  return login();
}

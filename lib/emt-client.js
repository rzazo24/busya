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
let loginPromise = null; // login() en vuelo, para no duplicar peticiones concurrentes

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
  // login Protected), no una fecha de caducidad. Si no viene o no es numérico, asumimos 55
  // minutos por seguridad — Number.isFinite descarta tanto el "no viene" (Number(undefined)
  // es NaN) como un valor no numérico inesperado (Number("algo") también es NaN), que sin
  // esta comprobación dejaba tokenExpiresAt en NaN y getValidToken() hacía login en cada
  // petición sin avisar de nada.
  const parsedSeconds = Number(accessData.tokenSecExpiration);
  const secondsValid = Number.isFinite(parsedSeconds) && parsedSeconds > 0 ? parsedSeconds : 55 * 60;

  tokenExpiresAt = Date.now() + secondsValid * 1000;

  return cachedToken;
}

export async function getValidToken() {
  const bufferMs = 60 * 1000; // renovamos 1 minuto antes de que caduque
  if (cachedToken && Date.now() < tokenExpiresAt - bufferMs) {
    return cachedToken;
  }
  // Dos peticiones concurrentes con el token caducado comparten el mismo login() en vuelo
  // en vez de duplicarlo cada una por su lado. Se limpia con .finally() tanto si funciona
  // como si falla: si solo se limpiara en el éxito, un fallo transitorio de EMT dejaría
  // loginPromise apuntando para siempre a una promesa ya rechazada, y ninguna petición
  // futura en esta misma instancia caliente volvería a intentar un login real.
  if (!loginPromise) {
    loginPromise = login().finally(() => {
      loginPromise = null;
    });
  }
  return loginPromise;
}

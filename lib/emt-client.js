// lib/emt-client.js
// Login y caché de accessToken compartidos entre las funciones serverless de EMT
// (api/emt-arrives.js y api/emt-stop-detail.js). El caché es en memoria por instancia
// de función — cada función que importa este módulo tiene su propio caché, no se
// comparte entre funciones distintas en Vercel.

const LOGIN_URL = 'https://openapi.emtmadrid.es/v1/mobilitylabs/user/login/';

let cachedToken = null;
let tokenExpiresAt = 0; // timestamp en ms

export async function login() {
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

export async function getValidToken() {
  const bufferMs = 60 * 1000; // renovamos 1 minuto antes de que caduque
  if (cachedToken && Date.now() < tokenExpiresAt - bufferMs) {
    return cachedToken;
  }
  return login();
}

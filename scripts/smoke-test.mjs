#!/usr/bin/env node
// scripts/smoke-test.mjs
// Uso: npm test (o node scripts/smoke-test.mjs)
//
// Comprueba de extremo a extremo, contra un servidor local mínimo, que los caminos
// principales de la app funcionan: monta el sitio estático + los handlers reales de
// api/*.js directamente (misma forma que Vercel: handler(req, res)), sin necesitar el CLI
// de Vercel ni credenciales para levantarlo. CRTM y nearby-stops son APIs públicas, así que
// se prueban contra el servicio real, no contra datos inventados — la lección de esta sesión
// es que un mock puede no coincidir con cómo se comporta la API real de verdad.
//
// EMT sí necesita credenciales (EMT_EMAIL/EMT_PASSWORD, de .env.local o del entorno); sin
// ellas, las comprobaciones que dependen de EMT se omiten en vez de fingir una respuesta.
//
// Al depender de la API real de CRTM, alguna comprobación puede fallar por su latencia
// irregular ya conocida (ver api/crtm-arrives.js) y no por un fallo de verdad de la app —
// cada una reintenta un par de veces sola, pero si aun así falla justo una de las que
// dependen de CRTM (no varias, no las de EMT/PWA/favoritos), probablemente merezca la pena
// relanzar el script antes de asumir que hay una regresión.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Paradas reales usadas a lo largo de esta sesión para verificar la app contra las APIs de
// verdad — no inventadas: 07288 (Av. Juan Gris-Miguel Hernández) tiene varias líneas de CRTM
// a la vez, útil para probar orden/favoritos de línea; 3351 es una parada real de EMT que en
// su momento sacó a la luz el caso "No estimations found" (ver CLAUDE.md).
const CRTM_STOP_ID = '07288';
const EMT_STOP_ID = '3351';
const NEARBY_COORDS = { latitude: 40.4657, longitude: -3.6892 }; // Plaza de Castilla

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

loadEnvLocal();
const hasEmtCreds = Boolean(process.env.EMT_EMAIL && process.env.EMT_PASSWORD);

const { default: crtmArrivesHandler } = await import(path.join(ROOT, 'api/crtm-arrives.js'));
const { default: nearbyStopsHandler } = await import(path.join(ROOT, 'api/nearby-stops.js'));
const emtHandlers = hasEmtCreds
  ? {
      arrives: (await import(path.join(ROOT, 'api/emt-arrives.js'))).default,
      stopDetail: (await import(path.join(ROOT, 'api/emt-stop-detail.js'))).default,
    }
  : null;

const server = await startServer();
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

const results = [];

try {
  await check('la página carga sin errores de consola', () =>
    withPage(async (page) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        // El script de Vercel Web Analytics (/_vercel/insights/script.js) solo existe en un
        // despliegue real con Analytics activado en el dashboard — aquí, contra el servidor
        // de pruebas, da 404 a propósito; no es un fallo de la app. El texto del mensaje no
        // lleva la URL (es siempre el mismo genérico "Failed to load resource..."), así que
        // hay que mirar location().url para identificarlo.
        if (m.type() === 'error' && !m.location().url.includes('/_vercel/insights/script.js')) errors.push(m.text());
      });
      await page.goto(baseUrl);
      await page.waitForLoadState('load');
      if (errors.length) throw new Error(errors.join(' | '));
    })
  );

  await check('buscar una parada real de CRTM muestra tiempos', () =>
    withPage(async (page) => {
      await page.goto(baseUrl);
      await page.click('.network-toggle__btn[data-network="crtm"]');
      await page.fill('#stop-id', CRTM_STOP_ID);
      await page.click('button[type="submit"]');
      await page.waitForSelector('.arrival-item, .arrivals-list__empty', { timeout: 15_000 });
      if (!(await page.locator('#status').isHidden())) throw new Error('se quedó en estado de carga/error');
    })
  );

  if (hasEmtCreds) {
    await check('buscar una parada real de EMT muestra tiempos (o "sin buses ahora")', () =>
      withPage(async (page) => {
        await page.goto(baseUrl);
        await page.fill('#stop-id', EMT_STOP_ID);
        await page.click('button[type="submit"]');
        await page.waitForSelector('.arrival-item, .arrivals-list__empty', { timeout: 15_000 });
        if (!(await page.locator('#status').isHidden())) throw new Error('se quedó en estado de carga/error');
      })
    );
  } else {
    skip('buscar una parada real de EMT', 'faltan EMT_EMAIL/EMT_PASSWORD (copia .env.example a .env.local)');
  }

  await check('guardar una parada como favorita y verla en el panel', () =>
    withPage(async (page) => {
      await page.goto(baseUrl);
      await page.click('.network-toggle__btn[data-network="crtm"]');
      await page.fill('#stop-id', CRTM_STOP_ID);
      await page.click('button[type="submit"]');
      await page.waitForSelector('.arrival-item, .arrivals-list__empty', { timeout: 15_000 });
      await page.click('#favorite-btn');
      await page.click('#favorites-open');
      await page.waitForSelector('.favorite-card');
      const count = await page.locator('.favorite-card').count();
      if (count !== 1) throw new Error(`se esperaba 1 tarjeta de favorito, hay ${count}`);
    })
  );

  await check('marcar una línea como favorita la resalta y la sube al principio', () =>
    withPage(async (page) => {
      await page.goto(baseUrl);
      await page.click('.network-toggle__btn[data-network="crtm"]');
      await page.fill('#stop-id', CRTM_STOP_ID);
      await page.click('button[type="submit"]');
      await page.waitForSelector('.arrival-item', { timeout: 15_000 });
      if ((await page.locator('.arrival-item').count()) < 2) {
        throw new Error(`la parada de prueba (${CRTM_STOP_ID}) no tiene suficientes llegadas ahora mismo para probar el orden`);
      }
      await page.locator('.arrival-item__line').last().click();
      await page.waitForTimeout(150);
      const firstIsFavorite = await page
        .locator('.arrival-item__line')
        .first()
        .evaluate((el) => el.classList.contains('arrival-item__line--favorite'));
      if (!firstIsFavorite) throw new Error('la línea marcada no subió al principio de la lista');
    })
  );

  await check('un enlace directo (?stop=&network=) carga esa parada', () =>
    withPage(async (page) => {
      await page.goto(`${baseUrl}/?stop=${CRTM_STOP_ID}&network=crtm`);
      await page.waitForSelector('.arrival-item, .arrivals-list__empty', { timeout: 15_000 });
      const stopIdValue = await page.inputValue('#stop-id');
      if (stopIdValue !== CRTM_STOP_ID) throw new Error(`se esperaba "${CRTM_STOP_ID}" en el input, salió "${stopIdValue}"`);
    })
  );

  await check('buscar paradas cercanas por geolocalización', () =>
    withPage(async (page, context) => {
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation(NEARBY_COORDS);
      await page.goto(baseUrl);
      await page.click('#nearby-btn');
      await page.waitForSelector('.nearby-stop', { timeout: 15_000 });
      if ((await page.locator('.nearby-stop').count()) === 0) throw new Error('no se encontró ninguna parada cercana');
    })
  );

  await check('un fallo de red no borra los tiempos ya en pantalla', () =>
    withPage(async (page) => {
      await page.goto(baseUrl);
      await page.click('.network-toggle__btn[data-network="crtm"]');
      await page.fill('#stop-id', CRTM_STOP_ID);
      await page.click('button[type="submit"]');
      await page.waitForSelector('.arrival-item', { timeout: 15_000 });
      await page.route('**/api/crtm-arrives**', (route) => route.abort('failed'));
      await page.click('#refresh-btn');
      await page.waitForTimeout(500);
      if ((await page.locator('.arrival-item').count()) === 0) throw new Error('los tiempos desaparecieron tras el fallo de red');
      const offline = await page.locator('#last-updated').evaluate((el) => el.classList.contains('last-updated--offline'));
      if (!offline) throw new Error('no se mostró el aviso "sin conexión"');
    })
  );

  await check('el service worker se registra', () =>
    withPage(async (page) => {
      await page.goto(baseUrl);
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10_000 });
    })
  );

  await check('los paneles de ayuda y favoritos abren y cierran sin errores', () =>
    withPage(async (page) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(baseUrl);
      await page.click('#help-open');
      await page.waitForSelector('.help-panel');
      await page.click('#help-close');
      await page.click('#favorites-open');
      await page.waitForSelector('.favorites-modal');
      await page.click('#favorites-close');
      if (errors.length) throw new Error(errors.join(' | '));
    })
  );
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => r.status === 'FAIL');
console.log(
  `\n${results.length - failed.length - results.filter((r) => r.status === 'SKIP').length} OK · ${results.filter((r) => r.status === 'SKIP').length} omitidas · ${failed.length} fallidas`
);
process.exitCode = failed.length > 0 ? 1 : 0;

// --- helpers ---

// La API real de CRTM tiene una latencia irregular ya conocida (ver api/crtm-arrives.js) —
// probado en esta misma sesión que puede tardar varios segundos de más incluso varias veces
// seguidas. 2 reintentos (3 intentos en total, con una pequeña pausa entre cada uno para no
// insistir justo cuando está más cargada) absorben eso sin dejar de detectar un fallo
// persistente de verdad.
async function check(name, fn, { retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await fn();
      results.push({ name, status: 'PASS' });
      console.log(`✓ ${name}`);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        console.log(`  (reintentando "${name}" tras: ${err.message})`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
  results.push({ name, status: 'FAIL', error: lastErr.message });
  console.log(`✗ ${name}\n  ${lastErr.message}`);
}

function skip(name, reason) {
  results.push({ name, status: 'SKIP', reason });
  console.log(`- ${name} (omitido: ${reason})`);
}

async function withPage(fn) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await fn(page, context);
  } finally {
    await context.close();
  }
}

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].trim();
    }
  }
}

function makeVercelRes(res) {
  return {
    _status: 200,
    status(code) {
      this._status = code;
      return this;
    },
    setHeader() {},
    json(body) {
      res.writeHead(this._status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    },
  };
}

function startServer() {
  return new Promise((resolve) => {
    const httpServer = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');

      if (url.pathname === '/api/crtm-arrives') {
        return crtmArrivesHandler({ query: { stopId: url.searchParams.get('stopId') } }, makeVercelRes(res));
      }
      if (url.pathname === '/api/nearby-stops') {
        return nearbyStopsHandler(
          { query: { lat: url.searchParams.get('lat'), lon: url.searchParams.get('lon') } },
          makeVercelRes(res)
        );
      }
      if (url.pathname === '/api/emt-arrives' || url.pathname === '/api/emt-stop-detail') {
        if (!emtHandlers) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Faltan EMT_EMAIL/EMT_PASSWORD en este servidor de pruebas' }));
        }
        const fn = url.pathname === '/api/emt-arrives' ? emtHandlers.arrives : emtHandlers.stopDetail;
        return fn({ query: { stopId: url.searchParams.get('stopId') } }, makeVercelRes(res));
      }

      let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
      filePath = path.join(ROOT, filePath);
      const ext = path.extname(filePath);
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          return res.end('Not found');
        }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    httpServer.listen(0, '127.0.0.1', () => resolve(httpServer));
  });
}

# BusYa

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat)

Tiempos de paso en tiempo real de los buses urbanos de EMT Madrid y los interurbanos de la
Comunidad de Madrid (CRTM) para una parada dada.

Tercer proyecto de una serie de apps con APIs públicas para portfolio (junto a
[Disaster Watch](https://github.com) con GDACS y un tracker de vuelos con OpenSky,
este último cancelado por restricciones de la API).

## Stack

- Vanilla HTML/CSS/JS, sin frameworks ni build step.
- Desplegado en Vercel como sitio estático + Vercel Functions mínimas que actúan de proxy
  hacia cada API de transporte.

### EMT Madrid

La API de EMT ([openapi.emtmadrid.es](https://openapi.emtmadrid.es)) requiere login con
email/password para obtener un `accessToken` (válido ~1 hora), así que no se puede consumir
100% desde el frontend estático sin exponer credenciales — de ahí el proxy.

Cuando una línea no tiene tiempo real fiable (frecuente en líneas nocturnas sin GPS), el
frontend cae a `/api/emt-stop-detail` y muestra la frecuencia de servicio de esa línea
("cada 8-12 min · hasta 23:30") en vez de dejar el hueco vacío. La API de tiempo real de EMT
no da la hora programada de paso por una parada concreta (eso solo está en su feed GTFS
estático); usar el horario/frecuencia por línea evita depender de ese feed.

### Interurbanos (CRTM)

La API de CRTM ([crtm.es/widgets/api](https://www.crtm.es/widgets/api)) es pública y no
requiere credenciales, pero no manda cabeceras CORS — el proxy (`api/crtm-arrives.js`) existe
solo para saltar esa restricción del navegador, no para esconder ningún secreto. Los números
de parada son propios de CRTM (formato `8_{código}`, donde `8` = autobuses interurbanos) y no
tienen relación con la numeración de EMT: un mismo número puede ser una parada distinta en
cada red, por eso el buscador tiene un selector de red. CRTM da la hora absoluta de paso en
vez de segundos restantes (se calcula en el proxy) y no distingue tiempo real de programado
con un sentinel como EMT, así que puede dar esperas de varias horas de madrugada sin que sea
un error.

## Estructura

```
busya/
├── api/
│   ├── emt-arrives.js       # GET /api/emt-arrives?stopId= — tiempos de paso EMT en tiempo real
│   ├── emt-stop-detail.js   # GET /api/emt-stop-detail?stopId= — horario/frecuencia por línea (EMT)
│   └── crtm-arrives.js      # GET /api/crtm-arrives?stopId= — tiempos de paso interurbanos (CRTM)
├── lib/
│   └── emt-client.js        # Login + caché de accessToken, compartido por las dos funciones de EMT
├── css/
│   └── style.css
├── js/
│   └── app.js                # Selector de red, búsqueda de parada, refresco de 30s, favoritos
├── index.html
├── favicon.svg
├── .env.example
└── package.json
```

## Desarrollo local

1. Copia `.env.example` a `.env.local` y rellena tus credenciales de
   [openapi.emtmadrid.es](https://openapi.emtmadrid.es) (email/password de tu cuenta):

   ```
   EMT_EMAIL=tu_email@ejemplo.com
   EMT_PASSWORD=tu_password
   ```

2. Instala el CLI de Vercel si no lo tienes y levanta el entorno local (sirve el estático
   y las funciones de `api/` juntos, tal como en producción):

   ```bash
   npx vercel dev
   ```

3. Abre `http://localhost:3000`, elige la red (EMT o Interurbano) e introduce un número de
   parada para consultar los tiempos de paso.

## Despliegue en Vercel

1. `npx vercel link` (o importa el repo desde el dashboard de Vercel).
2. Configura las variables de entorno en el proyecto de Vercel (Settings → Environment Variables):
   - `EMT_EMAIL`
   - `EMT_PASSWORD`
3. `npx vercel --prod`.

No hace falta ningún paso de build: Vercel sirve `index.html`/`css`/`js` como estático y
despliega cada archivo de `api/` como Function automáticamente.

## Licencia

Código bajo licencia MIT (ver [LICENSE](LICENSE)). Los datos de EMT Madrid y de CRTM se rigen
por los términos de uso de sus respectivas APIs, enlazadas más arriba.

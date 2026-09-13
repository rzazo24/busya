# BusYa

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat)

Tiempos de paso en tiempo real de los buses urbanos de EMT Madrid para una parada dada.

Tercer proyecto de una serie de apps con APIs públicas para portfolio (junto a
[Disaster Watch](https://github.com) con GDACS y un tracker de vuelos con OpenSky,
este último cancelado por restricciones de la API).

## Stack

- Vanilla HTML/CSS/JS, sin frameworks ni build step.
- Desplegado en Vercel como sitio estático + una Vercel Function mínima (`api/emt-arrives.js`)
  que actúa de proxy: esconde las credenciales de EMT y gestiona el `accessToken` temporal.

La API de EMT Madrid ([openapi.emtmadrid.es](https://openapi.emtmadrid.es)) requiere login con
email/password para obtener un `accessToken` (válido ~1 hora), así que no se puede consumir
100% desde el frontend estático sin exponer credenciales.

## Estructura

```
busya/
├── api/
│   ├── emt-arrives.js       # GET /api/emt-arrives?stopId= — tiempos de paso en tiempo real
│   └── emt-stop-detail.js   # GET /api/emt-stop-detail?stopId= — horario/frecuencia por línea
├── lib/
│   └── emt-client.js        # Login + caché de accessToken, compartido por ambas funciones
├── css/
│   └── style.css
├── js/
│   └── app.js                # Búsqueda de parada, refresco de 30s y fallback a horario/frecuencia
├── index.html
├── favicon.svg
├── .env.example
└── package.json
```

Cuando una línea no tiene tiempo real fiable (frecuente en líneas nocturnas sin GPS), el
frontend cae a `/api/emt-stop-detail` y muestra la frecuencia de servicio de esa línea
("cada 8-12 min · hasta 23:30") en vez de dejar el hueco vacío. La API de tiempo real de EMT
no da la hora programada de paso por una parada concreta (eso solo está en su feed GTFS
estático); usar el horario/frecuencia por línea evita depender de ese feed.

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

3. Abre `http://localhost:3000`, introduce un número de parada de EMT Madrid y consulta
   los tiempos de paso.

## Despliegue en Vercel

1. `npx vercel link` (o importa el repo desde el dashboard de Vercel).
2. Configura las variables de entorno en el proyecto de Vercel (Settings → Environment Variables):
   - `EMT_EMAIL`
   - `EMT_PASSWORD`
3. `npx vercel --prod`.

No hace falta ningún paso de build: Vercel sirve `index.html`/`css`/`js` como estático y
despliega cada archivo de `api/` como Function automáticamente.

## Fase 2 (pendiente)

Añadir buses interurbanos vía la API de CRTM ([portal.crtm.es](https://portal.crtm.es)) como
fuente de datos adicional, una vez que la integración con EMT esté estable.

## Licencia

Código bajo licencia MIT (ver [LICENSE](LICENSE)). Los datos de EMT Madrid se rigen por
los términos de uso de su propia API, enlazada más arriba.

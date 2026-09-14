// lib/geo.js
// Distancia en línea recta entre dos coordenadas GPS, compartida por api/crtm-arrives.js
// (distancia aproximada del bus) y api/nearby-stops.js (distancia a cada parada cercana).

export function haversineMeters(a, b) {
  const R = 6_371_000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

// Geometría del vuelo: distancia real sobre la Tierra, ruta y posición actual.
//
// Todo lo de acá es puro y determinista: dadas la salida, la llegada y los dos
// puntos, cualquiera —el servidor o los dos navegadores— calcula exactamente la
// misma posición del ave. Por eso el vuelo se ve igual en las dos pantallas sin
// mandar un solo byte de "dónde está el loro ahora": se manda cuándo salió y
// cuándo llega, y el resto se deduce.

export type Punto = { lat: number; lng: number };

const R_TIERRA_KM = 6371.0088;

const aRad = (g: number) => (g * Math.PI) / 180;
const aGrados = (r: number) => (r * 180) / Math.PI;

/** Distancia sobre la superficie de la Tierra, en km (haversine). */
export function distanciaKm(a: Punto, b: Punto): number {
  const dLat = aRad(b.lat - a.lat);
  const dLng = aRad(b.lng - a.lng);
  const lat1 = aRad(a.lat);
  const lat2 = aRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Punto intermedio del círculo máximo (la ruta que vuela un ave de verdad, no
 * la recta del mapa plano). `t` va de 0 (origen) a 1 (destino).
 *
 * Es interpolación esférica: sobre distancias largas la diferencia con una
 * recta en pantalla es enorme —Buenos Aires a Madrid se curva bien al norte—
 * y es justo lo que hace que la ruta se vea como una ruta de vuelo.
 */
export function puntoEnRuta(a: Punto, b: Punto, t: number): Punto {
  const lat1 = aRad(a.lat);
  const lng1 = aRad(a.lng);
  const lat2 = aRad(b.lat);
  const lng2 = aRad(b.lng);

  const d = distanciaKm(a, b) / R_TIERRA_KM;
  // Origen y destino prácticamente iguales: no hay ruta que interpolar y la
  // división de abajo se iría a infinito.
  if (d < 1e-9) return { lat: a.lat, lng: a.lng };

  const sd = Math.sin(d);
  const A = Math.sin((1 - t) * d) / sd;
  const B = Math.sin(t * d) / sd;

  const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
  const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);

  return {
    lat: aGrados(Math.atan2(z, Math.sqrt(x * x + y * y))),
    lng: aGrados(Math.atan2(y, x)),
  };
}

/** Hacia dónde mira el ave en este punto de la ruta, en grados (0 = norte). */
export function rumbo(a: Punto, b: Punto): number {
  const lat1 = aRad(a.lat);
  const lat2 = aRad(b.lat);
  const dLng = aRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (aGrados(Math.atan2(y, x)) + 360) % 360;
}

/** La ruta completa, para dibujarla como línea en el mapa. */
export function ruta(a: Punto, b: Punto, pasos = 64): Punto[] {
  const puntos: Punto[] = [];
  for (let i = 0; i <= pasos; i++) puntos.push(puntoEnRuta(a, b, i / pasos));
  return puntos;
}

/** Coordenadas válidas y sobre el planeta. */
export function puntoValido(p: unknown): p is Punto {
  const x = p as Punto;
  return (
    !!x &&
    Number.isFinite(x.lat) &&
    Number.isFinite(x.lng) &&
    Math.abs(x.lat) <= 90 &&
    Math.abs(x.lng) <= 180
  );
}

/**
 * Mueve un punto una distancia y un rumbo dados. Se usa para plantar el nido
 * de Doña Cotorra cerca de quien se registra, sin importar en qué lugar del
 * mundo esté.
 */
export function desplazar(p: Punto, km: number, rumboGrados: number): Punto {
  const d = km / R_TIERRA_KM;
  const lat1 = aRad(p.lat);
  const lng1 = aRad(p.lng);
  const br = aRad(rumboGrados);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(br) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
  return { lat: aGrados(lat2), lng: ((aGrados(lng2) + 540) % 360) - 180 };
}

// ---------- formato ----------

export function formatearDistancia(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  // Coma decimal: se escribe en español y "2.0 km" ahí se lee raro.
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km).toLocaleString("es-AR")} km`;
}

/**
 * "45 s", "1 min 15 s", "13 min", "2 h 15 min", "4 días 3 h". Redondea hacia
 * arriba: nadie quiere un ETA optimista.
 *
 * Abajo de diez minutos van también los segundos, y no por prolijidad: en los
 * vuelos cortos es lo único que distingue a un ave de otra. Sin eso, la cotorra
 * y el loro dicen los dos "2 min" y elegir deja de tener sentido.
 */
export function formatearDuracion(ms: number): string {
  if (ms <= 0) return "ya";
  const seg = Math.ceil(ms / 1000);
  if (seg < 60) return `${seg} s`;
  if (seg < 600) {
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return s ? `${m} min ${s} s` : `${m} min`;
  }
  const min = Math.ceil(seg / 60);
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  const restoMin = min % 60;
  if (horas < 24) return restoMin ? `${horas} h ${restoMin} min` : `${horas} h`;
  const dias = Math.floor(horas / 24);
  const restoHoras = horas % 24;
  const d = dias === 1 ? "1 día" : `${dias} días`;
  return restoHoras ? `${d} ${restoHoras} h` : d;
}

/** Countdown fino para el vuelo en curso: "04:31", "1:12:09". */
export function cuentaRegresiva(ms: number): string {
  if (ms <= 0) return "00:00";
  const total = Math.ceil(ms / 1000);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const dd = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${dd(m)}:${dd(s)}` : `${dd(m)}:${dd(s)}`;
}

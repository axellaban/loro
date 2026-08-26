// De coordenadas a "Palermo, Buenos Aires".
//
// Usa Nominatim (OpenStreetMap): gratis y sin API key, que es justo lo que
// necesita un MVP. A cambio pide portarse bien —máximo 1 pedido por segundo y
// un User-Agent que identifique la app—, así que acá hay cola y caché.
//
// Es 100% opcional: si falla, tarda o no hay red, el nido se queda sin nombre
// de lugar y no pasa nada más. La app nunca espera a esto para responder.

import { store } from "./store";

const UA = "Loros/0.1 (MVP de mensajeria; https://github.com/axellaban/loro)";

/** Redondeo a ~100 m: dos personas de la misma cuadra comparten caché. */
function clave(lat: number, lng: number): string {
  return `lugar:${lat.toFixed(3)},${lng.toFixed(3)}`;
}

// Nominatim pide 1 req/s. Esta cadena de promesas serializa los pedidos y les
// mete el segundo de espera sin bloquear nada más del servidor.
let cola: Promise<unknown> = Promise.resolve();
function enCola<T>(fn: () => Promise<T>): Promise<T> {
  const siguiente = cola.then(fn, fn);
  cola = siguiente.then(
    () => new Promise((r) => setTimeout(r, 1100)),
    () => new Promise((r) => setTimeout(r, 1100))
  );
  return siguiente;
}

async function consultar(lat: number, lng: number): Promise<string> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "12");
  url.searchParams.set("accept-language", "es");

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!r.ok) return "";
    const j: any = await r.json();
    const a = j?.address || {};
    const ciudad =
      a.city || a.town || a.village || a.municipality || a.county || a.state || "";
    const pais = a.country || "";
    if (ciudad && pais) return `${ciudad}, ${pais}`;
    return ciudad || pais || "";
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

/**
 * El lugar de un punto. Nunca tira error: en el peor caso devuelve "".
 * Cachea también los vacíos, para no reintentar en loop contra Nominatim.
 */
export async function lugarDe(lat: number, lng: number): Promise<string> {
  const k = clave(lat, lng);
  const guardado = await store().leer(k);
  if (guardado !== null) return guardado;

  const lugar = await enCola(() => consultar(lat, lng));
  await store().escribir(k, lugar);
  return lugar;
}

// Nadie ve dónde vive nadie.
//
// La app necesita la ubicación exacta para calcular el vuelo, pero eso es
// distinto de mostrarla. Acá se separan las dos cosas: el servidor guarda y
// calcula con el punto real, y lo que sale hacia el navegador de OTRA persona
// es siempre un punto corrido.
//
// Cómo: a cada nido se le asigna un desvío fijo —rumbo y distancia al azar,
// hasta 3 km— derivado de su id. Fijo importa: si cambiara en cada consulta, el
// punto bailaría en el mapa y, peor, con unas cuantas muestras se podría
// promediar el centro y recuperar la posición real. Al ser siempre el mismo, lo
// único que se ve es un punto equivocado y quieto.
//
// La distancia y el tiempo de vuelo NUNCA se calculan con esto: se calculan con
// el punto real, del lado del servidor, y viajan ya resueltos. Así el "2,2 km"
// que se lee es cierto aunque el punto del mapa no lo sea.

import { createHash } from "node:crypto";
import { desplazar, type Punto } from "./geo";

/** Radio del desvío, y también el del círculo que dibuja el mapa. Los dos son
 *  el mismo número a propósito: el círculo tiene que decir la verdad sobre
 *  cuánta imprecisión hay. */
export const RADIO_ZONA_KM = 3;

/**
 * El punto que se le muestra a los demás. Determinista: el mismo nido siempre
 * cae en el mismo lugar equivocado.
 */
export function zonaDe(punto: Punto, semilla: string): Punto {
  const h = createHash("sha256").update(`zona:${semilla}`).digest();
  const rumbo = (h.readUInt16BE(0) / 0xffff) * 360;
  // Raíz cuadrada para repartir parejo sobre el área del círculo. Sin ella los
  // puntos se apelotonan cerca del centro, que es justo donde no queremos.
  const distancia = Math.sqrt(h.readUInt16BE(2) / 0xffff) * RADIO_ZONA_KM;
  return desplazar(punto, distancia, rumbo);
}

// Lo que ve el navegador.
//
// Dos reglas viven acá, y las dos son del producto, no de la interfaz:
//
// 1. **El texto de un loro que todavía vuela no sale del servidor.** No es que
//    la UI lo tape — no lo tiene. Si viajara igual y la pantalla lo escondiera,
//    abrir las herramientas de desarrollo alcanzaría para leer antes de tiempo,
//    y la espera dejaría de ser real. Quien lo mandó sí ve siempre su propio
//    texto: lo escribió, ya lo sabe.
//
// 2. **Las coordenadas exactas de otra persona tampoco salen.** Se manda un
//    punto corrido hasta 3 km (lib/privacidad.ts) y el radio de esa imprecisión,
//    para que el mapa pueda dibujar una zona en vez de un pin. La distancia y
//    el tiempo de vuelo se calculan antes, con los puntos reales, así que son
//    exactos aunque el dibujo sea aproximado.
//
// Tu propio nido sí viaja exacto: es tu dato.

import type { AveId } from "./aves";
import type { Loro, Nido } from "./datos";
import { distanciaKm, type Punto } from "./geo";
import { RADIO_ZONA_KM, zonaDe } from "./privacidad";

export type NidoVista = {
  id: string;
  nombre: string;
  lugar: string;
  lat: number;
  lng: number;
  bot: boolean;
  ave: AveId;
  /** 0 en el nido propio; RADIO_ZONA_KM en los demás. El mapa dibuja con esto. */
  radioKm: number;
  /** Distancia real hasta vos, en km. Calculada en el servidor con los puntos
   *  de verdad — no se puede sacar de lat/lng, que vienen corridos. */
  distanciaKm?: number;
};

export type LoroVista = {
  id: string;
  ave: AveId;
  direccion: "enviado" | "recibido";
  otro: { id: string; nombre: string; bot: boolean };
  /** Puntas del vuelo: la tuya exacta, la del otro corrida. */
  origen: Punto;
  destino: Punto;
  distanciaKm: number;
  salida: number;
  llegada: number;
  turbo: boolean;
  llego: boolean;
  /** Se perdió: no llegó ni va a llegar. */
  perdido: boolean;
  /** Cuándo se perdió. null mientras siga volando — ver la nota de abajo. */
  extravio: number | null;
  /** Qué le pasó. Vacío hasta que efectivamente se pierde. */
  motivo: string;
  /** null mientras vuela y es para vos: todavía no existe de este lado. */
  texto: string | null;
  leido: number | null;
};

const punto = (n: Nido): Punto => ({ lat: n.lat, lng: n.lng });

/**
 * @param yo el nido de quien mira. Si es el mismo, va exacto; si no, corrido y
 *   con la distancia real ya calculada.
 */
export function verNido(n: Nido, yo?: Nido | null): NidoVista {
  const esMio = yo?.id === n.id;
  const p = esMio ? punto(n) : zonaDe(punto(n), n.id);
  return {
    id: n.id,
    nombre: n.nombre,
    lugar: n.lugar,
    lat: p.lat,
    lng: p.lng,
    bot: n.bot,
    ave: n.ave,
    radioKm: esMio ? 0 : RADIO_ZONA_KM,
    distanciaKm: esMio || !yo ? undefined : distanciaKm(punto(yo), punto(n)),
  };
}

export function verLoro(
  l: Loro,
  yo: string,
  nidos: Map<string, Nido>,
  ahora: number
): LoroVista {
  const enviado = l.de === yo;
  const otroId = enviado ? l.para : l.de;
  const otro = nidos.get(otroId);

  // El extravío se sortea al despegar y queda escrito, pero NO viaja hasta que
  // pasa. Si se mandara desde el principio, abrir las herramientas de
  // desarrollo diría de antemano que ese loro no va a llegar, y esperar algo
  // que ya sabés que no llega no es esperar.
  const extravio = l.extravio ?? null;
  const perdido = extravio !== null && ahora >= extravio;
  const llego = !perdido && ahora >= l.llegada;

  // La punta del otro se corre; la propia queda exacta. Las dos personas ven
  // líneas apenas distintas y el mismo avance: el tiempo es lo que importa.
  const origen = enviado ? l.origen : zonaDe(l.origen, l.de);
  const destino = enviado ? zonaDe(l.destino, l.para) : l.destino;

  return {
    id: l.id,
    ave: l.ave,
    direccion: enviado ? "enviado" : "recibido",
    otro: {
      id: otroId,
      nombre: otro?.nombre || "Alguien",
      bot: Boolean(otro?.bot),
    },
    origen,
    destino,
    // La real, calculada con los puntos de verdad al soltar el ave.
    distanciaKm: l.distanciaKm,
    salida: l.salida,
    llegada: l.llegada,
    turbo: l.turbo,
    llego,
    perdido,
    extravio: perdido ? extravio : null,
    motivo: perdido ? l.motivo || "" : "",
    // Un loro perdido nunca llega, así que su texto tampoco: quien lo esperaba
    // no va a saber nunca qué decía. Quien lo escribió lo sigue viendo.
    texto: enviado || llego ? l.texto : null,
    leido: l.leido,
  };
}

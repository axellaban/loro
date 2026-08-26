// Lo que ve el navegador.
//
// Acá está la regla que sostiene todo el producto: **el texto de un loro que
// todavía vuela no sale del servidor**. No es que la UI lo tape — no lo tiene.
// Si viajara igual y la pantalla lo escondiera, abrir las herramientas de
// desarrollo alcanzaría para leer antes de tiempo, y la espera dejaría de ser
// real.
//
// Quien lo mandó sí ve siempre su propio texto: lo escribió, ya lo sabe.

import type { AveId } from "./aves";
import type { Loro, Nido } from "./datos";
import type { Punto } from "./geo";

export type NidoVista = {
  id: string;
  nombre: string;
  lugar: string;
  lat: number;
  lng: number;
  bot: boolean;
  ave: AveId;
};

export type LoroVista = {
  id: string;
  ave: AveId;
  direccion: "enviado" | "recibido";
  /** La otra punta del vuelo, para el título de la tarjeta. */
  otro: { id: string; nombre: string; bot: boolean };
  origen: Punto;
  destino: Punto;
  distanciaKm: number;
  salida: number;
  llegada: number;
  turbo: boolean;
  llego: boolean;
  /** null mientras vuela y es para vos: todavía no existe de este lado. */
  texto: string | null;
  leido: number | null;
};

export function verNido(n: Nido): NidoVista {
  return {
    id: n.id,
    nombre: n.nombre,
    lugar: n.lugar,
    lat: n.lat,
    lng: n.lng,
    bot: n.bot,
    ave: n.ave,
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
  const llego = ahora >= l.llegada;

  return {
    id: l.id,
    ave: l.ave,
    direccion: enviado ? "enviado" : "recibido",
    otro: {
      id: otroId,
      nombre: otro?.nombre || "Alguien",
      bot: Boolean(otro?.bot),
    },
    origen: l.origen,
    destino: l.destino,
    distanciaKm: l.distanciaKm,
    salida: l.salida,
    llegada: l.llegada,
    turbo: l.turbo,
    llego,
    texto: enviado || llego ? l.texto : null,
    leido: l.leido,
  };
}

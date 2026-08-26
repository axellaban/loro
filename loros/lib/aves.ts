// Las cuatro aves y su tabla de balance.
//
// La velocidad NO es ornitología: es diseño de producto. En la vida real un
// guacamayo vuela más rápido que un perico, pero acá la regla que hace
// interesante la elección es el canje velocidad ↔ cuánto podés decir:
//
//   rápido = llega ya, pero te obliga a ser breve
//   lento  = tarda, pero te deja escribir una carta
//
// Si algún día se cambian estos números, cambiarlos ACÁ: la app entera (ETA,
// contador de caracteres, colores, mapa) sale de esta tabla.

export type AveId = "perico" | "cotorra" | "loro" | "guacamayo";

export type Ave = {
  id: AveId;
  nombre: string;
  /** Nombre con artículo, para armar frases: "tu perico", "la cotorra". */
  articulo: "el" | "la";
  emoji: string;
  velocidadKmh: number;
  maxCaracteres: number;
  /** Color de la especie. Se usa en la ruta del mapa, el ave y las tarjetas. */
  color: string;
  lema: string;
  descripcion: string;
};

export const AVES: Record<AveId, Ave> = {
  perico: {
    id: "perico",
    nombre: "Perico",
    articulo: "el",
    emoji: "⚡",
    velocidadKmh: 90,
    maxCaracteres: 120,
    color: "#a3e635",
    lema: "El express",
    descripcion:
      "Chiquito, ansioso y sin frenos. Llega antes que nadie pero no le entra nada largo en la cabeza.",
  },
  cotorra: {
    id: "cotorra",
    nombre: "Cotorra",
    articulo: "la",
    emoji: "💬",
    velocidadKmh: 60,
    maxCaracteres: 400,
    color: "#22d3ee",
    lema: "La charlatana",
    descripcion:
      "Habla hasta por los codos y vuela rápido igual. El punto medio para el día a día.",
  },
  loro: {
    id: "loro",
    nombre: "Loro",
    articulo: "el",
    emoji: "🦜",
    velocidadKmh: 40,
    maxCaracteres: 1000,
    color: "#10b981",
    lema: "El clásico",
    descripcion:
      "El de toda la vida. Se toma su tiempo, escucha todo y lo repite tal cual se lo dijiste.",
  },
  guacamayo: {
    id: "guacamayo",
    nombre: "Guacamayo",
    articulo: "el",
    emoji: "👑",
    velocidadKmh: 25,
    maxCaracteres: 2000,
    color: "#fbbf24",
    lema: "El ceremonioso",
    descripcion:
      "El más lento de todos, y eso es exactamente el mensaje. Mandarlo dice más que lo que lleva escrito.",
  },
};

export const AVES_LISTA: Ave[] = [
  AVES.perico,
  AVES.cotorra,
  AVES.loro,
  AVES.guacamayo,
];

export function esAveId(x: unknown): x is AveId {
  return typeof x === "string" && x in AVES;
}

export function ave(id: AveId): Ave {
  return AVES[id];
}

// La fórmula del vuelo, sin nada del servidor adentro.
//
// Vive aparte de datos.ts porque la necesitan los dos lados: el servidor para
// fijar la hora de llegada, y el navegador para mostrar —antes de mandar— cuánto
// va a tardar cada ave hasta esa persona. Si las dos cuentas no fueran
// exactamente la misma, la app prometería un tiempo y cumpliría otro.

import { AVES, type AveId } from "./aves";

/** Piso del vuelo: sin esto, mandarle a alguien de la misma cuadra sería un chat. */
export const VUELO_MINIMO_MS = 25_000;

/**
 * Uno de cada quinientos loros no llega nunca.
 *
 * Es poco y no es cero, y esa es exactamente la idea: si mandar algo no
 * pudiera salir mal, esperarlo no significaría nada. El número es chico a
 * propósito —a nadie le tiene que pasar dos veces seguidas— pero existe, y
 * cuando pasa, el mensaje se pierde de verdad: no hay reintento automático ni
 * copia guardada del lado de quien lo esperaba.
 *
 * Se puede pisar con LOROS_PROB_EXTRAVIO (0 a 1). Sirve para probar el camino
 * del extravío sin mandar quinientos loros.
 */
export function probabilidadExtravio(): number {
  const n = Number(process.env.LOROS_PROB_EXTRAVIO ?? "0.002");
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.002;
}

/** Para mostrarlo en la portada sin depender del entorno del servidor. */
export const EXTRAVIO_POR_DEFECTO = 0.002;

/**
 * Cuánto dura, más o menos, el vuelo de prueba del ave más lenta. El resto de
 * las aves entran abajo de ese techo, en proporción.
 */
export const TOPE_PRUEBA_MS = 180_000;

/** Piso del vuelo de prueba. Más corto que el normal: acá la gracia es mostrar. */
const MINIMO_PRUEBA_MS = 15_000;

function msCrudos(km: number, aveId: AveId, escala: number): number {
  return ((km / AVES[aveId].velocidadKmh) * 3_600_000) / (escala > 0 ? escala : 1);
}

/**
 * El "vuelo de prueba" NO es un multiplicador fijo.
 *
 * Con un ×60 pelado, cualquier trayecto corto se aplastaba contra el piso de 25
 * segundos y las cuatro aves daban exactamente el mismo tiempo — justo lo que la
 * app existe para diferenciar. Así que en vez de acelerar por un número, se
 * comprime el viaje entero hasta que el ave MÁS LENTA entre en ~3 minutos, y se
 * aplica ese mismo factor a las cuatro. Las proporciones entre especies quedan
 * intactas: el perico sigue llegando en un tercio de lo que tarda el guacamayo,
 * pase lo que pase con la distancia.
 */
function factorPrueba(km: number, escala: number): number {
  const masLenta = msCrudos(km, "guacamayo", escala);
  return Math.max(1, masLenta / TOPE_PRUEBA_MS);
}

export function duracionVuelo(
  km: number,
  aveId: AveId,
  prueba: boolean,
  escala = 1
): number {
  const crudo = msCrudos(km, aveId, escala);
  if (!prueba) return Math.max(VUELO_MINIMO_MS, Math.round(crudo));
  return Math.max(MINIMO_PRUEBA_MS, Math.round(crudo / factorPrueba(km, escala)));
}

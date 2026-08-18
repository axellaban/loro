// Separar tu voz del eco del entrevistador, con un solo número por instante.
//
// El problema, concreto: la pestaña compartida y tu micrófono se suman en el
// mismo grafo de audio y viajan juntos a Deepgram, que devuelve texto sin decir
// quién habló. Para etiquetar cada línea, la app mira si tu micrófono tenía
// energía en el momento en que se dijo ese tramo.
//
// Y ahí está la trampa: **el micrófono escucha la sala, y la sala incluye tus
// parlantes**. Cuando el entrevistador habla, su voz sale por los parlantes y
// vuelve a entrar por el micrófono. La cancelación de eco del navegador saca la
// mayor parte, pero lo que queda alcanza de sobra para superar un umbral fijo.
// Resultado: frases que llegaron limpias por el audio de la pestaña quedaban
// etiquetadas como dichas por vos.
//
// Un umbral absoluto NO puede separar esos dos casos, porque la pregunta no es
// cuánto suena el micrófono sino cuánto suena EN RELACIÓN a lo que está
// sonando en la pestaña en ese mismo instante. El eco es siempre una copia
// atenuada del original: si el micrófono apenas supera lo que se espera de esa
// atenuación, es eco; si lo supera de lejos, estás hablando vos —incluso
// encima de la otra persona.
//
// Cuánto atenúa depende de cosas que no se pueden saber de antemano (volumen de
// los parlantes, auriculares o no, ganancia del micrófono, qué tan bien le sale
// la cancelación a ESE navegador en ESA máquina), así que se mide sola mientras
// la sesión corre.

/** Debajo de esto el micrófono es ruido de sala, no voz. */
export const UMBRAL_VOZ = 0.02;

/** Debajo de esto la pestaña está en silencio: no hay eco posible que descontar. */
const PISO_PESTANIA = 0.01;

/**
 * Cuánto tiene que superar el micrófono al eco esperado para contar como voz
 * tuya. Hablando de verdad se queda muy por encima; el eco se mantiene cerca
 * del valor estimado, así que 2,5× separa los dos casos con margen.
 */
const MARGEN = 2.5;

/**
 * Arriba de esto, el micrófono es inequívocamente voz cercana y no eco.
 * Sirve para no aprender de esos instantes (ver `actualizarAcople`).
 */
const MIC_FUERTE = 0.09;

/** Estimación inicial del acople, antes de haber medido nada. */
export const ACOPLE_INICIAL = 0.6;

const ACOPLE_MIN = 0.05;
const ACOPLE_MAX = 1.5;

/**
 * Reestima cuánto de la pestaña se cuela por el micrófono, con la medición de
 * este instante. Devuelve el acople nuevo.
 *
 * Dos decisiones que sostienen todo:
 *
 *  - **Solo se aprende mientras la pestaña suena.** En silencio no hay eco que
 *    medir y la relación no significa nada.
 *  - **No se aprende de un micrófono fuerte.** Cuando hablás vos la relación se
 *    dispara, y aprender de ese instante subiría el piso hasta dejar de
 *    escucharte. Es un corte grueso, pero rompe la circularidad de "para saber
 *    si hablás necesito saber cuánto es eco, y para saber cuánto es eco
 *    necesito saber si hablás".
 *
 * Sube más rápido de lo que baja, a propósito: subestimar el eco te atribuye
 * frases ajenas —el bug que esto viene a arreglar—, mientras que sobreestimarlo
 * un rato solo hace que una frase tuya en voz muy baja caiga del otro lado.
 *
 * Pero "baja lento" tiene un límite: como se arranca suponiendo mucho eco, si
 * la baja es demasiado lenta la estimación nunca llega al valor real y el piso
 * queda por las nubes toda la sesión — con auriculares (donde casi no hay eco)
 * eso significa no detectarte nunca. Con estos números converge en ~1 segundo
 * de entrevistador hablando, que es lo primero que pasa en cualquier entrevista.
 */
const SUBE = 0.25;
const BAJA = 0.08;

export function actualizarAcople(acople: number, rmsMic: number, rmsTab: number): number {
  if (rmsTab <= PISO_PESTANIA || rmsMic >= MIC_FUERTE) return acople;
  const relacion = rmsMic / rmsTab;
  const alfa = relacion > acople ? SUBE : BAJA;
  const siguiente = acople + (relacion - acople) * alfa;
  return Math.min(Math.max(siguiente, ACOPLE_MIN), ACOPLE_MAX);
}

/**
 * ¿Lo que suena en el micrófono en este instante sos vos?
 *
 * Con `rmsTab` en 0 —modo micrófono, o pestaña muda— el piso del eco es 0 y
 * esto se reduce al umbral de siempre.
 */
export function esVozPropia(rmsMic: number, rmsTab: number, acople: number): boolean {
  return rmsMic >= UMBRAL_VOZ && rmsMic >= rmsTab * acople * MARGEN;
}

// Cuándo el candidato terminó de hablar.
//
// Es la decisión más delicada del simulador: si se contesta antes de tiempo, el
// entrevistador le habla encima a alguien que estaba pensando —lo peor que
// puede hacer una entrevista simulada—; si se espera de más, la conversación se
// vuelve lenta y muerta. No hay señal perfecta: Deepgram dice cuándo hubo
// silencio, no cuándo la idea terminó.
//
// Vive acá y no adentro del componente para poder probarlo: es lógica pura
// sobre un string, y es donde un error se paga caro.

/** Mínimo para considerar que hubo una respuesta real (evita cerrar por un carraspeo transcripto). */
export const MIN_ANSWER_CHARS = 10;

/**
 * Endpointing adaptativo. Total percibido = umbral + la gracia de CONFIRM_MS.
 *
 * RAPIDO se usa cuando todo indica que la persona terminó: contesta ágil en vez
 * de dejar un silencio incómodo. PACIENTE es el default de la duda.
 */
export const COMPLETE_MS = 1700;
export const INCOMPLETE_MS = 2600;

/** Ventana de gracia, cancelable si el candidato retoma la palabra. */
export const CONFIRM_MS = 600;

/** Silencio con el que Deepgram emite UtteranceEnd (`utterance_end_ms` en buildDgUrl). */
export const UTTERANCE_END_MS = 1500;

// Muletillas y conjunciones: si la respuesta termina así, casi seguro sigue.
export const TRAILING_INCOMPLETE = new Set([
  "y", "o", "u", "e", "pero", "porque", "que", "entonces", "asi", "así",
  "tipo", "eh", "este", "esto", "mmm", "em", "digamos", "bueno", "aver",
  "a", "de", "en", "con", "para", "como", "cuando", "si", "más", "mas",
  "o", "sea", "osea", "ta", "nada",
]);

/**
 * Palabras mínimas para que una frase puntuada cuente como respuesta terminada.
 *
 * Sin esto, la cortesía con la que arranca casi toda primera respuesta —"hola,
 * buenas tardes.", "sí, claro.", "buena pregunta."— cumple los tres requisitos
 * de abajo y entra en la ventana rápida: la persona saluda, toma aire para
 * arrancar de verdad, y a los 2,3s el entrevistador le habla encima. Es EL
 * corte que se ve en la primera pregunta y casi no se ve después, porque en el
 * medio se arranca a media idea y eso ya caía en la ventana larga.
 *
 * El costo es que una respuesta corta pero genuina ("tengo ocho años de
 * experiencia") espera ~0,9s más. Barato al lado de que te corten hablando.
 */
export const MIN_COMPLETE_WORDS = 12;

/**
 * Techo de la ventana rápida, en palabras acumuladas en este turno.
 *
 * Es la pieza que faltaba, y la que explica el corte que se veía en las
 * preguntas del medio y del final.
 *
 * `looksComplete` contesta "lo que dijo HASTA ACÁ es una oración bien formada",
 * y se lo estaba usando para contestar otra pregunta distinta: "¿terminó de
 * hablar?". En una respuesta corta las dos cosas casi coinciden. En una
 * respuesta larga no tienen nada que ver: la persona ya cerró cinco oraciones y
 * siguió hablando igual, así que cerrar una sexta no dice absolutamente nada
 * sobre si terminó. Y como `smart_format` le pone punto a todo lo que Deepgram
 * finaliza, a partir de las 12 palabras la condición se cumplía casi siempre —
 * o sea que el resto de la respuesta, entera, corría con el umbral corto: 2,1s
 * de pausa y el entrevistador arrancaba a hablar.
 *
 * Ahí está el "por qué en las últimas y no en las primeras": no cambia el
 * umbral, cambia cuánto pausa la gente. Las primeras respuestas están
 * ensayadas y salen de corrido; "contame de un conflicto con un compañero" se
 * piensa, y pensar dos segundos a mitad de respuesta es lo más normal del
 * mundo.
 *
 * 45 palabras son ~18 segundos hablando. La regla queda: si venís hablando poco
 * y cerraste una oración, te contesto ágil; si venís hablando hace rato, te
 * espero, porque un punto ya no significa que terminaste.
 */
export const MAX_PALABRAS_CIERRE_RAPIDO = 45;

function palabras(t: string): string[] {
  return t.split(/\s+/).filter(Boolean);
}

/**
 * ¿La respuesta suena terminada? Requiere sustancia, puntuación terminal (la da
 * smart_format en los finales) y que la última palabra no sea muletilla.
 * Mientras hay interinos sin puntuar cuenta como incompleta → paciente.
 */
export function looksComplete(text: string): boolean {
  const t = text.trim();
  if (t.length < MIN_ANSWER_CHARS) return false;
  if (!/[.!?…]$/.test(t)) return false;
  const w = palabras(t);
  if (w.length < MIN_COMPLETE_WORDS) return false;
  const lastWord = w[w.length - 1].toLowerCase().replace(/[.,!?…"”'’)\]]+$/g, "");
  return !!lastWord && !TRAILING_INCOMPLETE.has(lastWord);
}

/**
 * ¿Se puede cerrar rápido? Solo si suena terminada Y todavía es corta.
 *
 * Las dos condiciones juntas son el arreglo: sin la segunda, "suena terminada"
 * se cumple para siempre una vez que la respuesta creció.
 */
export function cierreRapido(answer: string): boolean {
  return looksComplete(answer) && palabras(answer.trim()).length <= MAX_PALABRAS_CIERRE_RAPIDO;
}

/** Cuánto silencio hay que esperar antes de dar por cerrada esta respuesta. */
export function silencioNecesario(answer: string): number {
  return cierreRapido(answer) ? COMPLETE_MS : INCOMPLETE_MS;
}

/**
 * ¿Alcanza el UtteranceEnd de Deepgram para cerrar en el acto?
 *
 * Este es el camino MÁS corto de los dos —Deepgram lo emite a los 1,5s de
 * silencio, contra los 1,7s del watchdog—, así que es por acá por donde
 * entraba la mayoría de los cortes. Con la misma condición que el otro camino,
 * las respuestas largas dejan de tener un atajo para que las corten.
 */
export function cierraConUtteranceEnd(answer: string): boolean {
  return cierreRapido(answer);
}

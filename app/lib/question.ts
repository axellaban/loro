// Detector de preguntas para la respuesta automática de /app.
//
// Deepgram manda `UtteranceEnd` en CADA silencio, no solo al final de una
// pregunta. Sin este filtro, la respuesta automática se disparaba con
// cualquier cosa: un "ok, perfecto", el entrevistador presentándose, o el
// relato de qué hace la empresa. El resultado eran tarjetas de respuesta a
// cosas que nunca fueron una pregunta.
//
// Acá decidimos si lo que se acumuló en el buffer amerita una respuesta.
// Criterio: hay pregunta si aparece un signo de interrogación, un pronombre
// interrogativo, o un pedido explícito de información ("contame de...",
// "dame un ejemplo", "walk me through..."). Todo lo demás no dispara.
//
// El sesgo es conservador a propósito: preferimos no responder de más (el
// botón "Responder ahora" siempre está disponible) antes que generar
// respuestas a frases que no eran preguntas.

// Corta el texto en oraciones conservando el signo final. Sin lookbehind: no
// se transpila y rompe el bundle entero en Safari iOS < 16.4 (mismo motivo
// que en simulador/tts.ts).
function splitSentences(text: string): string[] {
  const out: string[] = [];
  const re = /[.!?…]+/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const s = text.slice(start, m.index + m[0].length).trim();
    if (s) out.push(s);
    start = re.lastIndex;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

// Tokeniza en palabras, ignorando puntuación. Los acentos se conservan porque
// en español son justamente lo que distingue "qué" (interrogativo) de "que"
// (relativo) — es la señal más barata que tenemos.
function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’´]/g, "'") // apóstrofo tipográfico → recto ("I’d" y "I'd" iguales)
    .replace(/[¿?¡!.,;:()"“”…]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Muletillas y asentimientos. Solo se usan para descartar oraciones que son
// ENTERAMENTE relleno: sirve para las coletillas del tipo "¿ok?" o "¿sí?",
// que traen signo de pregunta pero no piden ninguna respuesta.
const FILLER = new Set([
  "si", "sí", "no", "ok", "oka", "okey", "okay", "dale", "claro", "obvio",
  "perfecto", "genial", "buenisimo", "buenísimo", "excelente", "correcto",
  "exacto", "bien", "muy", "bueno", "buena", "entiendo", "entendido", "aja",
  "ajá", "ajam", "mm", "mmm", "mhm", "eh", "ehh", "este", "listo", "gracias",
  "muchas", "tal", "cual", "de", "una", "uno", "y", "ah", "ahh", "ya", "verdad",
  "cierto", "vale", "sale", "joya", "barbaro", "bárbaro", "yeah", "yep", "yes",
  "right", "sure", "got", "it", "i", "see", "great", "cool", "nice", "thanks",
  "thank", "you", "awesome", "makes", "sense", "uh", "huh", "hmm", "alright",
  "mhmm", "gotcha", "understood",
]);

// Interrogativos acentuados: en ortografía española la tilde diacrítica marca
// justamente el uso interrogativo, así que valen en cualquier posición.
const ACCENTED_Q = new Set([
  "qué", "cuál", "cuáles", "cómo", "cuándo", "dónde", "adónde", "quién",
  "quiénes", "cuánto", "cuánta", "cuántos", "cuántas", "cuán", "por qué",
  "para qué",
]);

// Interrogativos sin tilde (Deepgram no siempre acentúa) e ingleses. Solo
// cuentan al INICIO de la oración: "que"/"como"/"cuando" en el medio son casi
// siempre relativos ("el proyecto que hice", "trabajé como analista").
const START_Q = new Set([
  "que", "cual", "cuales", "como", "cuando", "donde", "adonde", "quien",
  "quienes", "cuanto", "cuanta", "cuantos", "cuantas",
  "what", "which", "how", "when", "where", "who", "whom", "whose", "why",
]);

// Inversión del auxiliar en inglés: "Can you...", "Did you...".
const EN_AUX = new Set([
  "do", "does", "did", "can", "could", "would", "will", "should", "shall",
  "are", "is", "was", "were", "have", "has", "had", "am", "may", "might",
]);

// Pedidos explícitos de información. En español rioplatense/neutro el
// entrevistador casi siempre pide con imperativo + clítico ("contame",
// "explicanos"), que es inequívoco. Se exige el clítico justamente para no
// confundirlos con formas conjugadas normales: "cuenta" sola aparece en "ten
// en cuenta" y "habla" en "él habla", y ninguna de las dos es un pedido.
const START_REQUEST = new Set([
  "contame", "contanos", "contá", "contame", "cuentame", "cuéntame",
  "cuentanos", "cuéntanos", "hablame", "háblame", "hablanos", "háblanos",
  "hablemos", "explicame", "explícame", "explicanos", "explícanos",
  "describime", "describinos", "describí", "describe", "descríbeme",
  "decime", "decinos", "dime", "decí", "dame", "danos", "mostrame",
  "mostranos", "mostrá", "muestrame", "muéstrame", "comentame", "comentanos",
  "detallame", "profundicemos", "ampliá", "ampliame", "amplíame",
  "veamos", "repasemos", "pasemos", "arranquemos", "empecemos",
  "tell", "walk", "explain", "give", "share", "elaborate", "imagine",
  "suppose", "consider",
]);

// Pedidos que aparecen como frase, no como primera palabra.
const REQUEST_PHRASES = [
  "me gustaria saber", "me gustaría saber", "me gustaria que", "me gustaría que",
  "quiero que me", "quisiera que me", "quisiera saber", "necesito que me",
  "me interesa saber", "me interesaria saber", "me interesaría saber",
  "dame un ejemplo", "danos un ejemplo", "un ejemplo de", "un caso en el que",
  "una situacion en la que", "una situación en la que", "contame un",
  "hablame de", "háblame de", "hablemos de", "pasemos a",
  "podrias contarme", "podrías contarme", "podes contarme", "podés contarme",
  "puedes contarme", "podrias explicarme", "podrías explicarme",
  "tell me about", "walk me through", "give me an example", "i'd like to know",
  "i would like to know", "i want you to", "let's talk about", "lets talk about",
];

function isQuestionSentence(sentence: string): boolean {
  const w = words(sentence);
  if (w.length === 0) return false;

  // Oración compuesta solo de muletillas: descartar antes de mirar el signo de
  // pregunta, para que coletillas como "¿ok?" o "¿sí?" no disparen.
  if (w.every((t) => FILLER.has(t))) return false;

  // Señal más fuerte: el signo. `smart_format` de Deepgram puntúa, y en
  // español suele emitir también el de apertura.
  if (sentence.includes("?") || sentence.includes("¿")) return true;

  const first = w[0];
  const firstTwo = `${w[0]} ${w[1] ?? ""}`.trim();

  // Interrogativo acentuado en cualquier posición ("no me quedó claro qué
  // hiciste", "decime cómo lo resolviste").
  for (let i = 0; i < w.length; i++) {
    if (ACCENTED_Q.has(w[i])) return true;
    if ((w[i] === "por" || w[i] === "para") && w[i + 1] === "qué") return true;
  }

  // Interrogativo sin tilde, solo si abre la oración.
  if (START_Q.has(first)) return true;
  if ((first === "por" || first === "para") && w[1] === "que") return true;
  if (EN_AUX.has(first)) return true;

  // Pedido explícito de información.
  if (START_REQUEST.has(first)) return true;
  if (first === "let's" || firstTwo === "let s") return true;

  const flat = w.join(" ");
  for (const p of REQUEST_PHRASES) {
    if (flat.includes(p)) return true;
  }

  return false;
}

// ¿Lo que dijo el entrevistador amerita una respuesta automática?
//
// Se evalúa el buffer completo (todo lo dicho desde la última respuesta) y
// alcanza con que UNA de sus oraciones sea una pregunta: es habitual que el
// entrevistador dé contexto durante un rato y recién al final pregunte.
export function looksLikeQuestion(raw: string): boolean {
  const text = (raw || "").trim();
  if (!text) return false;
  // Muy corto para ser una pregunta con contenido suficiente como para
  // generar una respuesta útil. El botón manual sigue estando para esos casos.
  if (words(text).length < 3) return false;
  return splitSentences(text).some(isQuestionSentence);
}

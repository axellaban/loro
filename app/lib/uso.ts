// Cuánto consume cada pedido a un modelo.
//
// Los tres proveedores informan el consumo dentro de la misma respuesta que ya
// leemos —Gemini en `usageMetadata`, Anthropic en `message_start`/`message_delta`,
// OpenAI en el último chunk cuando se pide `stream_options.include_usage`—, pero
// hasta ahora el parser SSE devolvía solo texto y tiraba todo lo demás. Sin ese
// dato no había un solo número de consumo en ningún lado.
//
// Acá vive el acumulador, la traducción de cada proveedor a un formato común y
// el reporte (log de Vercel + evento a PostHog). Medir no puede costar caro ni
// romper nada: si algo falla, se loguea y la respuesta del usuario sigue igual.

import { costoTTSUSD, costoUSD } from "./precios";
import { eventoServidor } from "./track-server";

/**
 * Consumo de UN pedido, ya normalizado entre proveedores.
 *
 * `thinking` y `cache` son SUBCONJUNTOS informativos de `out` y de `in`
 * respectivamente — no se suman aparte al calcular el costo. Esto importa
 * porque cada proveedor los reporta distinto: OpenAI ya incluye los tokens de
 * razonamiento dentro de `completion_tokens`, y Gemini los informa aparte de
 * `candidatesTokenCount`. La normalización la hace cada `uso*()` de abajo para
 * que el costo se calcule siempre igual: in * precioIn + out * precioOut.
 */
export type Uso = {
  /** Tokens de entrada facturables (incluye los cacheados). */
  in: number;
  /** Tokens de salida facturables (incluye los de pensamiento). */
  out: number;
  /** Cuántos de los de salida se fueron en pensar. Informativo. */
  thinking: number;
  /** Cuántos de los de entrada vinieron de caché. Informativo. */
  cache: number;
};

export function nuevoUso(): Uso {
  return { in: 0, out: 0, thinking: 0, cache: 0 };
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

// Los tres lectores ASIGNAN en vez de sumar: los tres proveedores informan
// totales acumulados del pedido (Gemini repite `usageMetadata` en varios chunks
// con el total hasta ese momento), así que sumar contaría de más.

/** Gemini: sirve igual para un chunk SSE que para una respuesta completa. */
export function usoGemini(uso: Uso, evt: any): void {
  const u = evt?.usageMetadata;
  if (!u) return;
  uso.in = num(u.promptTokenCount);
  // Los tokens de pensamiento se facturan como salida, y Gemini los informa
  // FUERA de candidatesTokenCount: sin sumarlos, el costo de los modelos 3.x
  // sale sistemáticamente bajo.
  uso.thinking = num(u.thoughtsTokenCount);
  uso.out = num(u.candidatesTokenCount) + uso.thinking;
  uso.cache = num(u.cachedContentTokenCount);
}

/** Anthropic: el input llega en `message_start` y el output en `message_delta`. */
export function usoAnthropic(uso: Uso, evt: any): void {
  if (evt?.type === "message_start") {
    const u = evt.message?.usage;
    if (u) {
      uso.cache = num(u.cache_read_input_tokens);
      uso.in = num(u.input_tokens) + uso.cache + num(u.cache_creation_input_tokens);
    }
    return;
  }
  if (evt?.type === "message_delta") {
    uso.out = num(evt.usage?.output_tokens);
    return;
  }
  // Cualquier otro evento del stream no trae consumo.
  if (evt?.type) return;
  // Respuesta completa (sin streaming): trae todo junto en `usage`.
  const u = evt?.usage;
  if (!u) return;
  uso.cache = num(u.cache_read_input_tokens);
  uso.in = num(u.input_tokens) + uso.cache + num(u.cache_creation_input_tokens);
  uso.out = num(u.output_tokens);
}

/**
 * OpenAI: en streaming el consumo llega en el ÚLTIMO chunk y solo si el pedido
 * incluyó `stream_options.include_usage` (ver openaiBody). Sin eso no viene
 * nunca y el consumo de GPT queda en cero.
 */
export function usoOpenAI(uso: Uso, evt: any): void {
  const u = evt?.usage;
  if (!u) return;
  uso.in = num(u.prompt_tokens);
  // completion_tokens YA incluye los de razonamiento: no se suman aparte.
  uso.out = num(u.completion_tokens);
  uso.thinking = num(u.completion_tokens_details?.reasoning_tokens);
  uso.cache = num(u.prompt_tokens_details?.cached_tokens);
}

export type ReporteLLM = {
  /** Qué endpoint gastó: answer, answer-screen, session, sim-pregunta… */
  tag: string;
  provider: string;
  /** ID real de API del modelo que respondió (puede ser un fallback). */
  model: string;
  uso: Uso;
  /** El stream se cortó antes de terminar (el usuario cerró, o falló la red). */
  cortado?: boolean;
  /** Email del pase, cuando hay, para poder mirar el gasto por cliente. */
  usuario?: string;
};

/**
 * Deja el consumo de un pedido en los logs de Vercel y en PostHog.
 *
 * El log va siempre (sirve aunque no haya PostHog configurado) y en una sola
 * línea con formato fijo, para poder grepearlo. El evento va a PostHog, que es
 * donde se puede consultar de verdad: gasto por día, por modelo y por pase.
 */
export async function reportarUso(r: ReporteLLM): Promise<void> {
  try {
    const { uso } = r;
    // Un pedido que no informó nada no se reporta: sería ruido con ceros.
    if (uso.in === 0 && uso.out === 0) return;

    const usd = costoUSD(r.model, uso);
    console.log(
      `[uso] ${r.tag} ${r.provider}/${r.model} in=${uso.in} out=${uso.out} think=${uso.thinking} cache=${uso.cache} usd=${usd === null ? "sin-precio" : usd.toFixed(6)}${r.cortado ? " cortado=1" : ""}`
    );

    await eventoServidor(
      "uso_llm",
      {
        tag: r.tag,
        provider: r.provider,
        model: r.model,
        tokens_in: uso.in,
        tokens_out: uso.out,
        tokens_thinking: uso.thinking,
        tokens_cache: uso.cache,
        // null cuando el modelo no tiene precio cargado en precios.ts: en
        // PostHog se ve como un hueco, que es la señal de que falta cargarlo.
        usd,
        cortado: Boolean(r.cortado),
        con_pase: Boolean(r.usuario),
      },
      r.usuario
    );
  } catch (err: any) {
    console.error("[uso] no se pudo reportar:", err?.message || err);
  }
}

/** Lo mismo para la voz del simulador, que se cobra por caracter y no por token. */
export async function reportarUsoTTS(d: {
  model: string;
  caracteres: number;
  lang: string;
}): Promise<void> {
  try {
    if (d.caracteres <= 0) return;
    const usd = costoTTSUSD(d.caracteres);
    console.log(`[uso] sim-tts openai/${d.model} chars=${d.caracteres} usd=${usd.toFixed(6)}`);
    await eventoServidor("uso_tts", {
      tag: "sim-tts",
      provider: "openai",
      model: d.model,
      caracteres: d.caracteres,
      lang: d.lang,
      usd,
    });
  } catch (err: any) {
    console.error("[uso] no se pudo reportar el TTS:", err?.message || err);
  }
}

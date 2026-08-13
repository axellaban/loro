// Cuánto cuesta cada modelo, en USD por 1M de tokens.
//
// Vive acá y no repartido por los routes porque el costo se calcula en un solo
// lugar (`costoUSD`) y el número que sale de ahí termina en los logs y en
// PostHog: si un precio está mal, está mal en un solo renglón y se arregla en
// un solo renglón.
//
// IMPORTANTE — estos precios se cargaron a mano en agosto de 2026 y NO se
// verifican solos. Los proveedores los cambian seguido (los de Gemini bajaron
// ~50% en los últimos meses). Antes de tomar una decisión de plata con estos
// números, contrastalos con la factura real:
//   Gemini    https://ai.google.dev/gemini-api/docs/pricing
//   OpenAI    https://platform.openai.com/docs/pricing
//   Anthropic https://claude.com/pricing
// Cuando no hay precio cargado para un modelo, `costoUSD` devuelve null: se
// siguen midiendo los tokens y el costo queda en blanco, que es honesto. Nunca
// se inventa un número.

import type { Uso } from "./uso";

export type Precio = {
  /** USD por 1M de tokens de entrada. */
  in: number;
  /** USD por 1M de tokens de salida (incluye los de pensamiento). */
  out: number;
};

/**
 * Precios por ID REAL de API (el `model` del spec, no el `id` interno), porque
 * es el que se usa para pedir y el que aparece cuando entra un fallback.
 */
export const PRECIOS: Record<string, Precio> = {
  // Gemini — precios de lista del Developer API (tier pago).
  "gemini-3.1-flash-lite": { in: 0.25, out: 1.5 },
  "gemini-3.5-flash": { in: 1.5, out: 9.0 },
  "gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "gemini-2.5-flash-lite": { in: 0.1, out: 0.4 },
  // OpenAI
  "gpt-4.1": { in: 2.0, out: 8.0 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "gpt-5.5": { in: 5.0, out: 30.0 },
  "gpt-5.4-mini": { in: 0.75, out: 4.5 },
  // Anthropic
  "claude-haiku-4-5": { in: 1.0, out: 5.0 },
};

/**
 * Costo estimado de un pedido, o null si no hay precio cargado para el modelo.
 *
 * Es una ESTIMACIÓN por arriba: los tokens cacheados se cobran mucho más
 * barato (Gemini ~10%, Anthropic 10% en lectura) y acá se cuentan como entrada
 * normal. Preferimos que el número peque de caro: un presupuesto que se queda
 * corto avisa tarde.
 */
export function costoUSD(model: string, uso: Uso): number | null {
  const p = PRECIOS[model];
  if (!p) return null;
  return (uso.in * p.in + uso.out * p.out) / 1_000_000;
}

/**
 * Voz del simulador. OpenAI cobra tts-1 por caracter y gpt-4o-mini-tts por
 * token de audio; a fines de medición los dos rondan los USD 15 por 1M de
 * caracteres de entrada, así que se usa esa vara para ambos y se aclara acá
 * que para gpt-4o-mini-tts es una aproximación.
 */
export const PRECIO_TTS_POR_1M_CARACTERES = 15.0;

export function costoTTSUSD(caracteres: number): number {
  return (caracteres * PRECIO_TTS_POR_1M_CARACTERES) / 1_000_000;
}

/**
 * Transcripción en vivo. Deepgram cobra por minuto de audio, no por token, y
 * el consumo real se consulta contra su API (ver /api/uso): este número está
 * solo para traducir minutos a plata en ese reporte.
 */
export const PRECIO_DEEPGRAM_POR_MINUTO = 0.0048;

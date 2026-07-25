// Registro único de modelos, compartido por la UI (selector) y por los routes.
//
// La clave de este archivo son las CAPACIDADES: cada proveedor cambió la forma
// del request entre generaciones, así que el adapter no puede adivinar por el
// prefijo del ID. Concretamente:
//
//   - Gemini 2.5 usa `thinkingConfig.thinkingBudget` y RECHAZA `thinkingLevel`.
//     Gemini 3.x es al revés. Mandar el equivocado es un 400 seguro — esta era
//     la razón por la que sumar modelos nuevos "nunca funcionaba".
//   - OpenAI separa los modelos de razonamiento (max_completion_tokens +
//     reasoning_effort, sin temperature) de los clásicos (max_tokens +
//     temperature).
//
// Por eso cada modelo declara acá cómo se le habla, en vez de que cada rama del
// backend lo deduzca.

export type Provider = "gemini" | "openai" | "anthropic";

export type ModelSpec = {
  /** ID interno (el que se guarda en localStorage y viaja en el body). */
  id: string;
  /** Nombre completo, para la lista desplegada. */
  label: string;
  /** Versión corta para la píldora cerrada (en mobile no entra el completo). */
  short: string;
  tag: string;
  provider: Provider;
  /** ID real que espera la API del proveedor. */
  model: string;
  /** Gemini: qué forma de thinking acepta esta generación. */
  thinking?: "budget" | "level";
  /** OpenAI: familia de razonamiento (GPT-5.x / o-series). */
  reasoning?: boolean;
};

export const MODELS: ModelSpec[] = [
  // Gemini 2.5: el que viene funcionando bien, se mantiene como default.
  {
    id: "gemini-flash",
    label: "Gemini 2.5 Flash",
    short: "Gemini Flash",
    tag: "Recomendado",
    provider: "gemini",
    model: "gemini-2.5-flash",
    thinking: "budget",
  },
  {
    id: "gemini-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    short: "Gemini Lite",
    tag: "Rápido",
    provider: "gemini",
    model: "gemini-2.5-flash-lite",
    thinking: "budget",
  },
  // Gemini 3.x: thinkingLevel, NO thinkingBudget.
  {
    id: "gemini-3-5-flash",
    label: "Gemini 3.5 Flash",
    short: "Gemini 3.5",
    tag: "Inteligente",
    provider: "gemini",
    model: "gemini-3.5-flash",
    thinking: "level",
  },
  {
    id: "gemini-3-1-flash-lite",
    label: "Gemini 3.1 Flash Lite",
    short: "Gemini 3.1",
    tag: "Rápido",
    provider: "gemini",
    model: "gemini-3.1-flash-lite",
    thinking: "level",
  },
  // OpenAI clásicos: max_tokens + temperature.
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    short: "GPT-4.1",
    tag: "Inteligente",
    provider: "openai",
    model: "gpt-4.1",
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 Mini",
    short: "GPT-4.1 Mini",
    tag: "Rápido",
    provider: "openai",
    model: "gpt-4.1-mini",
  },
  // OpenAI razonamiento: max_completion_tokens + reasoning_effort, sin temperature.
  {
    id: "gpt-5.5",
    label: "GPT-5.5",
    short: "GPT-5.5",
    tag: "Inteligente",
    provider: "openai",
    model: "gpt-5.5",
    reasoning: true,
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 Mini",
    short: "GPT-5.4 Mini",
    tag: "Rápido",
    provider: "openai",
    model: "gpt-5.4-mini",
    reasoning: true,
  },
  {
    id: "claude-haiku",
    label: "Claude 4.5 Haiku",
    short: "Claude Haiku",
    tag: "Lento",
    provider: "anthropic",
    model: "claude-haiku-4-5",
  },
];

/** El default es el modelo que hoy funciona bien en producción. */
export const DEFAULT_MODEL_ID = "gemini-flash";

export function specById(id: string): ModelSpec {
  return MODELS.find((m) => m.id === id) || MODELS[0];
}

/**
 * Resuelve el spec a partir de lo que manda el cliente. Se busca por `model`
 * (el ID real de API) y, si no, por el ID interno. Si no matchea nada conocido
 * se cae al default en vez de mandarle a la API un ID arbitrario.
 */
export function specForRequest(provider: string, model: string): ModelSpec {
  const byModel = MODELS.find((m) => m.model === model && m.provider === provider);
  if (byModel) return byModel;
  const byId = MODELS.find((m) => m.id === model);
  if (byId) return byId;
  const firstOfProvider = MODELS.find((m) => m.provider === provider);
  return firstOfProvider || MODELS[0];
}

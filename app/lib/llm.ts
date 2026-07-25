// Constructores del body de cada proveedor, compartidos por los dos routes y
// por el endpoint de diagnóstico. Que el health check use ESTE mismo código es
// lo que hace que su resultado signifique algo: si ahí da OK, el request real
// sale igual.

import type { ModelSpec } from "./models";

/**
 * Nivel de thinking para Gemini 3.x. Se deja como constante única porque es el
 * valor que puede necesitar ajuste según lo que acepte cada modelo ("low" vs
 * "minimal"); el endpoint /api/models/health lo confirma en un request.
 */
export const GEMINI_THINKING_LEVEL = "low";

export function geminiUrl(model: string, method: "generateContent" | "streamGenerateContent", apiKey: string) {
  const qs = method === "streamGenerateContent" ? "?alt=sse&key=" : "?key=";
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}${qs}${apiKey}`;
}

// Gemini 2.5 acepta thinkingBudget y rechaza thinkingLevel; 3.x al revés.
// Mandar el que no corresponde es un 400.
function geminiThinking(spec: ModelSpec): Record<string, unknown> {
  if (spec.thinking === "level") return { thinkingConfig: { thinkingLevel: GEMINI_THINKING_LEVEL } };
  if (spec.thinking === "budget") return { thinkingConfig: { thinkingBudget: 0 } };
  return {};
}

export function geminiBody(opts: {
  spec: ModelSpec;
  system: string;
  user: string;
  maxOutputTokens: number;
  temperature: number;
  json?: boolean;
  /** Frame de la cámara del candidato, para que el entrevistador "lo vea". */
  image?: { mimeType: string; data: string } | null;
}) {
  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens,
    ...geminiThinking(opts.spec),
  };
  if (opts.json) generationConfig.responseMimeType = "application/json";
  const parts: Array<Record<string, unknown>> = [{ text: opts.user }];
  if (opts.image) {
    parts.push({ inlineData: { mimeType: opts.image.mimeType, data: opts.image.data } });
  }
  return {
    contents: [{ role: "user", parts }],
    systemInstruction: { parts: [{ text: opts.system }] },
    generationConfig,
  };
}

export function openaiBody(opts: {
  spec: ModelSpec;
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  stream?: boolean;
  json?: boolean;
}) {
  const body: Record<string, unknown> = {
    model: opts.spec.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  };
  if (opts.stream) body.stream = true;
  if (opts.json) body.response_format = { type: "json_object" };
  if (opts.spec.reasoning) {
    // Los modelos de razonamiento usan max_completion_tokens y rechazan
    // temperature. reasoning_effort bajo es clave para la latencia en vivo.
    body.max_completion_tokens = opts.maxTokens;
    body.reasoning_effort = "low";
  } else {
    body.max_tokens = opts.maxTokens;
    body.temperature = opts.temperature;
  }
  return body;
}

export function anthropicBody(opts: {
  spec: ModelSpec;
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  stream?: boolean;
}) {
  const body: Record<string, unknown> = {
    model: opts.spec.model,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  };
  if (opts.stream) body.stream = true;
  return body;
}

export const ANTHROPIC_HEADERS = (apiKey: string) => ({
  "Content-Type": "application/json",
  "x-api-key": apiKey,
  "anthropic-version": "2023-06-01",
});

/**
 * El primer bloque de texto de una respuesta de Anthropic. Leer `content[0]`
 * directamente devuelve undefined si el modelo emite otro tipo de bloque antes.
 */
export function anthropicText(json: any): string {
  const blocks = Array.isArray(json?.content) ? json.content : [];
  const block = blocks.find((b: any) => b?.type === "text");
  return block?.text || "";
}

/**
 * Deja el fallo en los logs de Vercel. Antes no se logueaba nada, y por eso
 * nunca se pudo diagnosticar por qué fallaban los modelos.
 */
export function logUpstream(provider: string, model: string, status: number, body: string) {
  console.error(
    `[llm] ${provider}/${model} falló con ${status}: ${(body || "").slice(0, 500)}`
  );
}

/** Mensaje de error legible que nombra el modelo, en vez del body crudo. */
export function upstreamMessage(provider: string, model: string, status: number, body: string) {
  const detail = (body || "").slice(0, 300);
  return `El modelo ${model} (${provider}) devolvió ${status}. ${detail}`;
}

// Constructores del body de cada proveedor, compartidos por los dos routes y
// por el endpoint de diagnóstico. Que el health check use ESTE mismo código es
// lo que hace que su resultado signifique algo: si ahí da OK, el request real
// sale igual.

import type { ModelSpec } from "./models";

/**
 * Turnos previos de una conversación, para los usos multi-turno (el chat sobre
 * una sesión guardada). Van ANTES del mensaje `user` final.
 */
export type Turn = { role: "user" | "assistant"; text: string };

/**
 * Imagen adjunta a un pedido, en base64 (sin el prefijo `data:`). Los tres
 * proveedores la aceptan pero cada uno con su propia forma, así que el tipo es
 * único y la traducción vive en cada builder.
 */
export type LlmImage = { mimeType: string; data: string };

/**
 * Nivel de thinking para Gemini 3.x. Se deja como constante única porque es el
 * valor que puede necesitar ajuste según lo que acepte cada modelo ("low" vs
 * "minimal"); el endpoint /api/models/health lo confirma en un request.
 */
export const GEMINI_THINKING_LEVEL = "low";

/**
 * `maxOutputTokens` es un presupuesto COMPARTIDO entre los tokens de
 * pensamiento y los de la respuesta visible. Los Gemini 3.x piensan, así que
 * sin este margen se comen parte del presupuesto y el texto se corta a mitad de
 * palabra. Es un tope, no un objetivo: se factura lo que se genera, y la
 * profundidad del pensamiento la sigue fijando `thinkingLevel`.
 */
export const GEMINI_THINKING_HEADROOM = 2048;

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
  history?: Turn[];
  /** Imagen adjunta: frame de la cámara del candidato, o una captura de la
      pantalla compartida para que el modelo lea lo que hay ahí. */
  image?: LlmImage | null;
}) {
  // `maxOutputTokens` es el presupuesto de la respuesta VISIBLE; a los modelos
  // que piensan se les suma el margen que va a consumir el pensamiento.
  const thinks = opts.spec.thinking === "level";
  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens + (thinks ? GEMINI_THINKING_HEADROOM : 0),
    ...geminiThinking(opts.spec),
  };
  if (opts.json) generationConfig.responseMimeType = "application/json";
  const parts: Array<Record<string, unknown>> = [{ text: opts.user }];
  if (opts.image) {
    parts.push({ inlineData: { mimeType: opts.image.mimeType, data: opts.image.data } });
  }
  // Gemini llama "model" al turno del asistente.
  const contents = [
    ...(opts.history || []).map((t) => ({
      role: t.role === "assistant" ? "model" : "user",
      parts: [{ text: t.text }],
    })),
    { role: "user", parts },
  ];
  return {
    contents,
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
  history?: Turn[];
  image?: LlmImage | null;
}) {
  // Con imagen, `content` deja de ser un string y pasa a ser la lista de
  // partes que espera la API de visión.
  const userContent = opts.image
    ? [
        { type: "text", text: opts.user },
        { type: "image_url", image_url: { url: `data:${opts.image.mimeType};base64,${opts.image.data}` } },
      ]
    : opts.user;
  const body: Record<string, unknown> = {
    model: opts.spec.model,
    messages: [
      { role: "system", content: opts.system },
      ...(opts.history || []).map((t) => ({ role: t.role, content: t.text })),
      { role: "user", content: userContent },
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
  history?: Turn[];
  image?: LlmImage | null;
}) {
  // La imagen va ANTES del texto: Anthropic recomienda ese orden cuando la
  // consigna se refiere a lo que hay en la imagen.
  const userContent = opts.image
    ? [
        {
          type: "image",
          source: { type: "base64", media_type: opts.image.mimeType, data: opts.image.data },
        },
        { type: "text", text: opts.user },
      ]
    : opts.user;
  const body: Record<string, unknown> = {
    model: opts.spec.model,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    system: opts.system,
    messages: [
      ...(opts.history || []).map((t) => ({ role: t.role, content: t.text })),
      { role: "user", content: userContent },
    ],
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
 * Extrae el texto de un evento SSE de Gemini y avisa si la respuesta se cortó
 * por presupuesto de tokens. Sin esto, un corte se ve como texto truncado a
 * mitad de palabra y no queda rastro de por qué.
 */
export function geminiChunk(evt: any, model: string): string | null {
  const finish = evt?.candidates?.[0]?.finishReason;
  if (finish && finish !== "STOP") {
    console.warn(`[llm] gemini/${model} terminó por ${finish} (respuesta posiblemente cortada)`);
  }
  return evt?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
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

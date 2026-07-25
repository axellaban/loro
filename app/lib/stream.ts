// Streaming de texto de los tres proveedores, compartido por /api/answer y
// /api/session. Antes vivía entero dentro de /api/answer; al aparecer un
// segundo consumidor se extrajo acá en vez de copiarlo, que es exactamente la
// duplicación que hizo que los modelos no-Gemini nunca funcionaran.

import { specForRequest, type ModelSpec, type Provider } from "./models";
import {
  ANTHROPIC_HEADERS,
  anthropicBody,
  geminiBody,
  geminiChunk,
  geminiUrl,
  logUpstream,
  openaiBody,
  upstreamMessage,
  type Turn,
} from "./llm";

/**
 * Cadena de intentos: el modelo pedido y después el estable del MISMO
 * proveedor. Nunca cambia de proveedor: si el usuario eligió Claude y falla,
 * responder con Gemini sería mentirle sobre qué modelo contestó.
 */
export function fallbackChain(spec: ModelSpec): ModelSpec[] {
  const STABLE: Record<Provider, string> = {
    gemini: "gemini-2.5-flash",
    openai: "gpt-4.1-mini",
    anthropic: "claude-haiku-4-5",
  };
  const stableId = STABLE[spec.provider];
  if (spec.model === stableId) return [spec];
  return [spec, specForRequest(spec.provider, stableId)];
}

/**
 * Parser SSE genérico: lee el body upstream, parte por líneas "data:", y por
 * cada JSON extrae el texto con `extract`. Reenvía solo texto plano al cliente.
 */
export function sseTextStream(
  upstream: ReadableStream<Uint8Array>,
  extract: (json: string) => string | null
): ReadableStream {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.getReader();
  let buffer = "";
  return new ReadableStream({
    // El pull loopea hasta encolar datos reales: si resuelve sin encolar,
    // Vercel Edge puede pausar el stream (fix redescubierto del historial viejo).
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        let enqueuedAny = false;
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const json = trimmed.slice(5).trim();
          if (!json || json === "[DONE]") continue;
          try {
            const text = extract(json);
            if (text) {
              controller.enqueue(encoder.encode(text));
              enqueuedAny = true;
            }
          } catch {
            // ignora fragmentos incompletos
          }
        }
        if (enqueuedAny) return;
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

function textStreamResponse(stream: ReadableStream, model: string) {
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "x-loro-model": model },
  });
}

export type StreamOpts = {
  specs: ModelSpec[];
  system: string;
  user: string;
  history?: Turn[];
  maxTokens: number;
  /** Los modelos de razonamiento gastan tokens pensando: necesitan más tope. */
  reasoningMaxTokens?: number;
  temperature: number;
  /** Prefijo de los logs, para saber qué endpoint falló. */
  tag: string;
};

/** Despacha al proveedor del spec. Todos devuelven texto plano en streaming. */
export async function streamLLM(opts: StreamOpts): Promise<Response> {
  const provider = opts.specs[0].provider;
  try {
    if (provider === "anthropic") return await streamAnthropic(opts);
    if (provider === "openai") return await streamOpenAI(opts);
    return await streamGemini(opts);
  } catch (err: any) {
    console.error(`[${opts.tag}] excepción con ${provider}/${opts.specs[0].model}:`, err?.message || err);
    return new Response(`Error del modelo ${opts.specs[0].model}: ${err?.message || "desconocido"}`, {
      status: 502,
    });
  }
}

async function streamGemini(opts: StreamOpts): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return new Response("Falta GEMINI_API_KEY en las variables de entorno.", { status: 500 });
  let detail = "";
  let status = 502;
  let lastModel = "";
  for (const spec of opts.specs) {
    lastModel = spec.model;
    // El thinking se arma según la generación del modelo: 2.5 usa
    // thinkingBudget, 3.x usa thinkingLevel, y cada uno rechaza el del otro.
    const upstream = await fetch(geminiUrl(spec.model, "streamGenerateContent", apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        geminiBody({
          spec,
          system: opts.system,
          user: opts.user,
          history: opts.history,
          maxOutputTokens: opts.maxTokens,
          temperature: opts.temperature,
        })
      ),
    });
    if (upstream.ok && upstream.body) {
      if (spec !== opts.specs[0]) console.warn(`[${opts.tag}] fallback a ${spec.model}`);
      return textStreamResponse(
        sseTextStream(upstream.body, (json) => geminiChunk(JSON.parse(json), spec.model)),
        spec.model
      );
    }
    status = upstream.status;
    detail = await upstream.text().catch(() => "");
    logUpstream("gemini", spec.model, status, detail);
  }
  return new Response(upstreamMessage("gemini", lastModel, status, detail), { status: 502 });
}

async function streamAnthropic(opts: StreamOpts): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      "Falta ANTHROPIC_API_KEY en Vercel para usar Claude. Cargá el token o elegí otro modelo.",
      { status: 500 }
    );
  }
  let detail = "";
  let status = 502;
  let lastModel = "";
  for (const spec of opts.specs) {
    lastModel = spec.model;
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: ANTHROPIC_HEADERS(apiKey),
      body: JSON.stringify(
        anthropicBody({
          spec,
          system: opts.system,
          user: opts.user,
          history: opts.history,
          maxTokens: opts.maxTokens,
          temperature: opts.temperature,
          stream: true,
        })
      ),
    });
    if (upstream.ok && upstream.body) {
      if (spec !== opts.specs[0]) console.warn(`[${opts.tag}] fallback a ${spec.model}`);
      return textStreamResponse(
        sseTextStream(upstream.body, (json) => {
          const evt = JSON.parse(json);
          // Solo nos interesan los deltas de texto del bloque de contenido.
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
            return evt.delta.text ?? null;
          }
          return null;
        }),
        spec.model
      );
    }
    status = upstream.status;
    detail = await upstream.text().catch(() => "");
    logUpstream("anthropic", spec.model, status, detail);
  }
  return new Response(upstreamMessage("anthropic", lastModel, status, detail), { status: 502 });
}

async function streamOpenAI(opts: StreamOpts): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      "Falta OPENAI_API_KEY en Vercel para usar GPT. Cargá el token o elegí otro modelo.",
      { status: 500 }
    );
  }
  let detail = "";
  let status = 502;
  let lastModel = "";
  for (const spec of opts.specs) {
    lastModel = spec.model;
    // Los modelos de razonamiento usan max_completion_tokens y rechazan
    // temperature. Lo decide el spec, no un prefijo adivinado.
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(
        openaiBody({
          spec,
          system: opts.system,
          user: opts.user,
          history: opts.history,
          maxTokens: spec.reasoning ? opts.reasoningMaxTokens ?? opts.maxTokens : opts.maxTokens,
          temperature: opts.temperature,
          stream: true,
        })
      ),
    });
    if (upstream.ok && upstream.body) {
      if (spec !== opts.specs[0]) console.warn(`[${opts.tag}] fallback a ${spec.model}`);
      return textStreamResponse(
        sseTextStream(upstream.body, (json) => {
          const evt = JSON.parse(json);
          return evt.choices?.[0]?.delta?.content ?? null;
        }),
        spec.model
      );
    }
    status = upstream.status;
    detail = await upstream.text().catch(() => "");
    logUpstream("openai", spec.model, status, detail);
  }
  return new Response(upstreamMessage("openai", lastModel, status, detail), { status: 502 });
}

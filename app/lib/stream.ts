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
  type LlmImage,
  type Turn,
} from "./llm";
import { nuevoUso, reportarUso, usoAnthropic, usoGemini, usoOpenAI } from "./uso";

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
 *
 * `alTerminar` corre una sola vez cuando el stream se cierra, ya sea porque
 * terminó o porque el cliente cortó. Es el enganche de la medición de consumo:
 * el total de tokens recién se conoce con el último evento, y sin esto no hay
 * ningún momento en el que reportarlo.
 *
 * Se espera (await) antes de cerrar: en edge, un fetch suelto después de cerrar
 * la respuesta se puede morir con la función. El costo es que el stream cierra
 * lo que tarde el reporte DESPUÉS del último token (~100ms, 2s en el peor caso
 * si PostHog no contesta). El texto ya llegó entero, así que no se ve como
 * lentitud de la respuesta; a lo sumo el "generando" tarda un instante más en
 * apagarse. El log a Vercel sale siempre, aunque el evento se pierda.
 */
export function sseTextStream(
  upstream: ReadableStream<Uint8Array>,
  extract: (json: string) => string | null,
  alTerminar?: (cortado: boolean) => void | Promise<void>
): ReadableStream {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.getReader();
  let buffer = "";
  let terminado = false;
  const terminar = async (cortado: boolean) => {
    if (terminado) return;
    terminado = true;
    await alTerminar?.(cortado);
  };
  return new ReadableStream({
    // El pull loopea hasta encolar datos reales: si resuelve sin encolar,
    // Vercel Edge puede pausar el stream (fix redescubierto del historial viejo).
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          await terminar(false);
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
      // El cliente cortó (cerró la pestaña, cambió de pregunta). Lo consumido
      // hasta acá ya se factura igual, así que se reporta marcado como cortado.
      void terminar(true);
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
  /** Imagen adjunta (captura de pantalla, frame de cámara). */
  image?: LlmImage | null;
  /** Prefijo de los logs, para saber qué endpoint falló. */
  tag: string;
  /** Email del pase, si lo hay: permite ver el consumo por cliente. */
  usuario?: string;
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
          image: opts.image,
          maxOutputTokens: opts.maxTokens,
          temperature: opts.temperature,
        })
      ),
    });
    if (upstream.ok && upstream.body) {
      if (spec !== opts.specs[0]) console.warn(`[${opts.tag}] fallback a ${spec.model}`);
      const uso = nuevoUso();
      return textStreamResponse(
        sseTextStream(
          upstream.body,
          (json) => {
            const evt = JSON.parse(json);
            usoGemini(uso, evt);
            return geminiChunk(evt, spec.model);
          },
          (cortado) =>
            reportarUso({ tag: opts.tag, provider: "gemini", model: spec.model, uso, cortado, usuario: opts.usuario })
        ),
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
          image: opts.image,
          maxTokens: opts.maxTokens,
          temperature: opts.temperature,
          stream: true,
        })
      ),
    });
    if (upstream.ok && upstream.body) {
      if (spec !== opts.specs[0]) console.warn(`[${opts.tag}] fallback a ${spec.model}`);
      const uso = nuevoUso();
      return textStreamResponse(
        sseTextStream(
          upstream.body,
          (json) => {
            const evt = JSON.parse(json);
            usoAnthropic(uso, evt);
            // Solo nos interesan los deltas de texto del bloque de contenido.
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              return evt.delta.text ?? null;
            }
            return null;
          },
          (cortado) =>
            reportarUso({ tag: opts.tag, provider: "anthropic", model: spec.model, uso, cortado, usuario: opts.usuario })
        ),
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
          image: opts.image,
          maxTokens: spec.reasoning ? opts.reasoningMaxTokens ?? opts.maxTokens : opts.maxTokens,
          temperature: opts.temperature,
          stream: true,
        })
      ),
    });
    if (upstream.ok && upstream.body) {
      if (spec !== opts.specs[0]) console.warn(`[${opts.tag}] fallback a ${spec.model}`);
      const uso = nuevoUso();
      return textStreamResponse(
        sseTextStream(
          upstream.body,
          (json) => {
            const evt = JSON.parse(json);
            // El último chunk viene sin `choices` y solo con `usage`.
            usoOpenAI(uso, evt);
            return evt.choices?.[0]?.delta?.content ?? null;
          },
          (cortado) =>
            reportarUso({ tag: opts.tag, provider: "openai", model: spec.model, uso, cortado, usuario: opts.usuario })
        ),
        spec.model
      );
    }
    status = upstream.status;
    detail = await upstream.text().catch(() => "");
    logUpstream("openai", spec.model, status, detail);
  }
  return new Response(upstreamMessage("openai", lastModel, status, detail), { status: 502 });
}

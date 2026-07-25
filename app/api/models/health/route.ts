export const runtime = "edge";

// Diagnóstico: pega un request mínimo a CADA modelo del registro y reporta si
// responde o con qué error. Usa los mismos constructores de body que los routes
// reales (app/lib/llm.ts), así que un OK acá significa que el request de verdad
// también sale bien.
//
// Existe porque hasta ahora, cuando un modelo fallaba, no había forma de ver
// por qué: el error se tapaba con un fallback silencioso y no se logueaba nada.

import { rateLimit, sameOriginStrict } from "../../../lib/ratelimit";
import { MODELS, type ModelSpec } from "../../../lib/models";
import {
  ANTHROPIC_HEADERS,
  anthropicBody,
  anthropicText,
  geminiBody,
  geminiUrl,
  openaiBody,
} from "../../../lib/llm";

const PING_SYSTEM = "Respondé con una sola palabra.";
const PING_USER = "Decí OK.";

type Check = {
  id: string;
  label: string;
  provider: string;
  model: string;
  ok: boolean;
  status: number | null;
  ms: number;
  /** Texto que devolvió el modelo (para confirmar que responde de verdad). */
  sample?: string;
  error?: string;
};

async function checkGemini(spec: ModelSpec, apiKey: string): Promise<Partial<Check>> {
  const res = await fetch(geminiUrl(spec.model, "generateContent", apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      geminiBody({ spec, system: PING_SYSTEM, user: PING_USER, maxOutputTokens: 16, temperature: 0 })
    ),
  });
  if (!res.ok) return { ok: false, status: res.status, error: (await res.text().catch(() => "")).slice(0, 400) };
  const j = await res.json();
  return { ok: true, status: 200, sample: (j.candidates?.[0]?.content?.parts?.[0]?.text || "").slice(0, 80) };
}

async function checkOpenAI(spec: ModelSpec, apiKey: string): Promise<Partial<Check>> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(
      // Los de razonamiento gastan tokens pensando antes de escribir, así que
      // un tope muy bajo devolvería vacío: se les da más margen.
      openaiBody({
        spec,
        system: PING_SYSTEM,
        user: PING_USER,
        maxTokens: spec.reasoning ? 256 : 16,
        temperature: 0,
      })
    ),
  });
  if (!res.ok) return { ok: false, status: res.status, error: (await res.text().catch(() => "")).slice(0, 400) };
  const j = await res.json();
  return { ok: true, status: 200, sample: (j.choices?.[0]?.message?.content || "").slice(0, 80) };
}

async function checkAnthropic(spec: ModelSpec, apiKey: string): Promise<Partial<Check>> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: ANTHROPIC_HEADERS(apiKey),
    body: JSON.stringify(
      anthropicBody({ spec, system: PING_SYSTEM, user: PING_USER, maxTokens: 16, temperature: 0 })
    ),
  });
  if (!res.ok) return { ok: false, status: res.status, error: (await res.text().catch(() => "")).slice(0, 400) };
  const j = await res.json();
  return { ok: true, status: 200, sample: anthropicText(j).slice(0, 80) };
}

/**
 * El guard de los otros endpoints exige el header `Origin`, que el navegador NO
 * manda al abrir una URL en la barra de direcciones — con ese criterio este
 * endpoint sería inusable justo cuando hace falta. Se acepta también la
 * navegación directa del navegador, que es el caso de uso real. Ambas señales
 * son spoofeables, igual que el `Origin` del resto de la app; el rate-limit de
 * abajo es lo que evita que se queme presupuesto.
 */
function allowDiagnostics(req: Request): boolean {
  if (sameOriginStrict(req)) return true;
  return req.headers.get("sec-fetch-dest") === "document";
}

export async function GET(req: Request) {
  if (!allowDiagnostics(req)) {
    return new Response("Origen no permitido.", { status: 403 });
  }
  // Cada corrida gasta tokens en los tres proveedores: se limita fuerte.
  const limit = rateLimit(req, "models-health", 6, 60_000);
  if (!limit.ok) {
    return new Response(`Demasiadas corridas. Probá en ${limit.retryAfter}s.`, { status: 429 });
  }

  const keys = {
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  };

  const checks = await Promise.all(
    MODELS.map(async (spec): Promise<Check> => {
      const base: Check = {
        id: spec.id,
        label: spec.label,
        provider: spec.provider,
        model: spec.model,
        ok: false,
        status: null,
        ms: 0,
      };
      const apiKey = keys[spec.provider];
      if (!apiKey) {
        return { ...base, error: `Falta la API key de ${spec.provider} en las variables de entorno.` };
      }
      const started = Date.now();
      try {
        const result =
          spec.provider === "gemini"
            ? await checkGemini(spec, apiKey)
            : spec.provider === "openai"
              ? await checkOpenAI(spec, apiKey)
              : await checkAnthropic(spec, apiKey);
        return { ...base, ...result, ms: Date.now() - started };
      } catch (err: any) {
        return { ...base, ms: Date.now() - started, error: err?.message || "error de red" };
      }
    })
  );

  const failing = checks.filter((c) => !c.ok);
  for (const c of failing) {
    console.error(`[health] ${c.provider}/${c.model} → ${c.status ?? "-"} ${c.error || ""}`);
  }

  return Response.json(
    {
      ok: failing.length === 0,
      total: checks.length,
      failing: failing.length,
      checks,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

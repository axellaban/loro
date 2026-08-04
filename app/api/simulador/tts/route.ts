export const runtime = "edge";

import { capacityClosed, rateLimit, sameOriginStrict } from "../../../lib/ratelimit";

// Voz del entrevistador del simulador. gpt-4o-mini-tts soporta `instructions`
// (tono/acento); tts-1 no, por eso el retry lo omite.
const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_MODEL_FALLBACK = "tts-1";
// nova = voz femenina; el acento y el ritmo se piden por instructions (el
// modelo nuevo no soporta `speed`, el fallback tts-1 sí).
const TTS_VOICE = "nova";
const FALLBACK_SPEED = 1.4;

// "Voz de loro hablador" bien marcada + ritmo muy rápido. Se pide por
// instructions porque gpt-4o-mini-tts no soporta el parámetro `speed`.
// Fácil de dosificar cambiando estas constantes.
// Nota: la VELOCIDAD real se acelera en el cliente (playbackRate en tts.ts),
// no acá, porque el modelo casi no respeta el ritmo pedido por instructions.
const PARROT_TEXTURE =
  "MUY IMPORTANTE — textura vocal dominante, exagerala en cada palabra: voz de loro hablador, muy nasal, rasposa, metálica y predominantemente aguda, con una textura hueca, estridente y ocasionales chasquidos guturales.";

const INSTRUCTIONS: Record<"es" | "en", string> = {
  es: `${PARROT_TEXTURE} Sos una entrevistadora argentina con acento rioplatense (Buenos Aires): voseo, entonación porteña, la 'll' e 'y' como 'sh' suave. Ritmo conversacional natural, sin pausas largas.`,
  en: `VERY IMPORTANT — dominant vocal texture, exaggerate it on every word: talking-parrot voice, very nasal, raspy, metallic and mostly high-pitched, with a hollow, shrill texture and occasional guttural clicks. You are an American female job interviewer. Natural conversational pace, no long pauses.`,
};

async function requestSpeech(apiKey: string, model: string, text: string, lang: "es" | "en") {
  const body: Record<string, unknown> = {
    model,
    voice: TTS_VOICE,
    input: text,
    response_format: "mp3",
  };
  if (model === TTS_MODEL) {
    body.instructions = INSTRUCTIONS[lang];
  } else {
    body.speed = FALLBACK_SPEED;
  }
  return fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

/**
 * ¿Anda la voz del entrevistador?
 *
 * Cuando el TTS falla, el simulador no muestra ningún error: cae a un camino
 * degradado que escribe la pregunta entera de golpe y deja al loro en el clip
 * de espera. Visto desde afuera parece un problema del video, y por ese
 * desvío se pierde mucho tiempo. (Pasó.)
 *
 * Este GET pide una palabra a OpenAI y cuenta qué contestó. Nunca devuelve la
 * clave ni nada derivado de ella.
 */
export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  const sinCache = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" };
  if (!apiKey) {
    return Response.json(
      {
        vozConfigurada: false,
        ayuda:
          "Falta OPENAI_API_KEY en este deploy. Cargala en Vercel y REDEPLOYÁ: las variables nuevas no entran en un deploy ya hecho.",
      },
      { headers: sinCache }
    );
  }

  const probar = async (modelo: string) => {
    try {
      const r = await requestSpeech(apiKey, modelo, "hola", "es");
      if (r.ok) return { modelo, ok: true, bytes: (await r.arrayBuffer()).byteLength };
      return { modelo, ok: false, status: r.status, detalle: (await r.text().catch(() => "")).slice(0, 300) };
    } catch (e: any) {
      return { modelo, ok: false, detalle: `no se pudo llegar a OpenAI: ${e?.message || e}` };
    }
  };

  const principal = await probar(TTS_MODEL);
  // El fallback solo se prueba si el principal falló, para no gastar de gusto.
  const respaldo = principal.ok ? undefined : await probar(TTS_MODEL_FALLBACK);

  return Response.json(
    {
      vozConfigurada: true,
      principal,
      respaldo,
      // Lo que de verdad importa: si los dos fallan, el loro no habla y la
      // pregunta aparece de golpe.
      hayVoz: principal.ok || Boolean(respaldo?.ok),
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "desconocido",
    },
    { headers: sinCache }
  );
}

export async function POST(req: Request) {
  if (capacityClosed()) {
    return Response.json(
      { error: "Cupos agotados por hoy. Sumate a la lista de espera y te avisamos.", closed: true },
      { status: 503 }
    );
  }
  if (!sameOriginStrict(req)) {
    return new Response("Origen no permitido.", { status: 403 });
  }
  // ~15 oraciones por sesión de 5 preguntas; 40/min deja margen de reintentos.
  const rl = rateLimit(req, "sim-tts", 40, 60_000);
  if (!rl.ok) {
    return new Response("Demasiadas solicitudes. Esperá un momento.", {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfter) },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response("Falta OPENAI_API_KEY para la voz del entrevistador.", { status: 500 });
  }

  let body: { text?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Body inválido.", { status: 400 });
  }

  const text = (body.text || "").trim().slice(0, 600);
  if (!text) {
    return new Response("Texto vacío.", { status: 400 });
  }
  const lang: "es" | "en" = body.lang === "en" ? "en" : "es";

  let upstream = await requestSpeech(apiKey, TTS_MODEL, text, lang);
  if (!upstream.ok && upstream.status >= 400 && upstream.status < 500) {
    upstream = await requestSpeech(apiKey, TTS_MODEL_FALLBACK, text, lang);
  }
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return new Response(`TTS error: ${detail || upstream.status}`, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}

export const runtime = "edge";

import { capacityClosed, rateLimit, sameOriginStrict } from "../../lib/ratelimit";
import { specForRequest, type ModelSpec, type Provider } from "../../lib/models";
import {
  ANTHROPIC_HEADERS,
  anthropicBody,
  anthropicText,
  geminiBody,
  geminiChunk,
  geminiUrl,
  logUpstream,
  openaiBody,
  upstreamMessage,
} from "../../lib/llm";

// El spec del registro decide la forma del request (ver app/lib/models.ts).
// Sin overrides por env var: pisaban en silencio el modelo del selector.

const SYSTEM_PROMPT_INTERVIEWER = `Sos el ENTREVISTADOR. No sos un asistente que aconseja: estás en la llamada haciendo la entrevista en vivo al candidato, ahora mismo.

Recibís:
1. EMPRESA y DESCRIPCIÓN DEL PUESTO (contexto).
2. El PERFIL del candidato (su CV, experiencia, logros).
3. El TIPO DE ENTREVISTA (Técnica, Comportamiento, HR, General).
4. El HISTORIAL de la entrevista hasta ahora (todas las preguntas hechas por vos y las respuestas dadas por el candidato).

Tu tarea: Generar la SIGUIENTE PREGUNTA de la entrevista.
Reglas críticas:
1. Sé un entrevistador profesional, realista y directo. Adapta tu tono al seniority del puesto.
2. Si el HISTORIAL está vacío, da una breve bienvenida (máximo 1 oración) y haz la primera pregunta de forma natural basada en su CV y el puesto.
3. Si ya hay historial, lee la última respuesta del candidato. Si fue vaga, superficial, genérica o quedó a medias, HACÉ UN FOLLOW-UP que la desafíe ("¿podés darme un ejemplo concreto?", "¿qué número/resultado tuvo eso?", "¿qué habrías hecho distinto?") en vez de dejarla pasar — presioná como un buen entrevistador, calibrando la exigencia al seniority del puesto. Si la respuesta fue sólida, hacé un comentario breve de transición y avanzá a la siguiente pregunta.
4. Mantén tu respuesta MUY corta y conversacional (máximo 2-3 oraciones en total). Debe ser ideal para leerse de un vistazo o ser leída por un sintetizador de voz.
5. Haz una sola pregunta a la vez. No acumules preguntas.
6. Responde SIEMPRE en el idioma indicado en "## IDIOMA DE LA RESPUESTA".
7. Si aparece un bloque "## SEÑAL DEL SISTEMA" indicando que la última respuesta pudo cortarse: tu próximo turno NO es una pregunta nueva ni un follow-up de desafío. Es una repregunta breve y amable para que el candidato COMPLETE lo que estaba diciendo ("uy, se cortó un poco eso, ¿querés terminar la idea?" / "¿ahí llegaste a lo que querías decir o querés agregar algo?"). No lo trates como un error suyo — pudo ser un problema técnico. Ofrecelo UNA sola vez; si igual queda corta, seguí normal.
8. Si aparece un bloque "## CIERRE": la entrevista terminó. NO hagas ninguna pregunta. Cerrá con calidez en 1-2 oraciones: agradecé el tiempo del candidato y hacé un comentario final humano y positivo (SIN dar feedback ni puntuar), y avisá que en un momento le preparás el informe. Ej: "Buenísimo, con esto cerramos. Te agradezco un montón el tiempo, dame unos segundos que te armo el informe."
9. Devuelve ÚNICAMENTE el texto que diría el entrevistador. Sin preámbulos, sin "Aquí está la pregunta", sin etiquetas como "Pregunta:" ni "Entrevistador:". La ÚNICA excepción es la marca de la regla 12.
10. Si el PROGRESO indica que es la ÚLTIMA pregunta, avisale brevemente al candidato que es la última antes de formularla.
11. Si recibís una imagen del candidato (un frame de su cámara), INCLUÍ antes de la pregunta un comentario positivo y específico sobre lo que realmente ves — su ropa ("qué buena esa camisa"), lentes, sonrisa, el espacio de fondo, la iluminación. Si el contexto lo amerita, mencioná 2 o 3 detalles hilados con naturalidad ("me gusta esa camisa, y se ve un espacio muy ordenado detrás tuyo — se nota que te preparaste"). Concreto y natural, para que se note que lo estás viendo de verdad; que no suene a checklist. Siempre amable y profesional: nunca negativo, nunca sobre el cuerpo, nunca incómodo. Después seguís con la pregunta. Si en este turno NO recibís imagen, NO menciones NADA sobre su apariencia, ropa, cara, fondo, entorno ni iluminación, y NO retomes comentarios visuales de turnos anteriores: enfocate solo en el contenido de sus respuestas.
12. MARCA OBLIGATORIA. Tu PRIMERA LÍNEA, sola y antes de todo lo demás, tiene que ser exactamente una de estas dos:
#NUEVA — abrís un TEMA NUEVO: una pregunta sobre algo que todavía no se habló.
#MISMA — seguís con el tema que ya estaba. Entra acá TODO esto: un follow-up que pide un ejemplo o un número sobre la respuesta anterior; una repregunta porque la respuesta se cortó; y una corrección porque entendiste mal algo y el candidato te lo aclaró.
Si el candidato te corrige ("no es X, es Y") o te aclara algo que interpretaste mal, tu turno es SIEMPRE #MISMA: reconocé el error en media oración y volvé a hacer la MISMA pregunta ya corregida. Nunca cambies de tema en ese turno.
La marca va sola en su línea y el texto que decís arranca en la línea siguiente. NUNCA la leas en voz alta ni la menciones: es para el sistema, no para el candidato.`;

const SYSTEM_PROMPT_FEEDBACK = `Sos un COACH DE ENTREVISTAS experto. Tu tarea es analizar una simulación de entrevista completa y generar un reporte de feedback detallado, constructivo y accionable.
Recibís:
1. EMPRESA y DESCRIPCIÓN DEL PUESTO.
2. PERFIL DEL CANDIDATO.
3. El HISTORIAL completo de la entrevista (preguntas del entrevistador y respuestas del candidato).

Tu tarea: Generar un reporte en formato JSON con la siguiente estructura exacta:
{
  "score": 85,
  "level": "Sólido",
  "verdict": "En una entrevista real para este puesto, estarías cerca de avanzar a la siguiente ronda.",
  "topPriority": "La UNA cosa de mayor impacto que tenés que cambiar (una frase, concreta).",
  "nextStep": "El próximo paso accionable para lograrlo (algo que pueda hacer hoy).",
  "summary": "Resumen general del desempeño...",
  "indicators": [
    { "name": "Claridad", "score": 80 },
    { "name": "Estructura", "score": 70 },
    { "name": "Fit con el puesto", "score": 75 },
    { "name": "Confianza", "score": 65 },
    { "name": "Comunicación", "score": 70 }
  ],
  "strengths": [
    "Fortaleza 1...",
    "Fortaleza 2..."
  ],
  "improvements": [
    "Mejora 1...",
    "Mejora 2..."
  ],
  "questions": [
    {
      "question": "Pregunta realizada",
      "answer": "Respuesta dada",
      "score": 72,
      "analysis": "Análisis de qué estuvo bien y qué faltó en esa respuesta específica.",
      "suggestion": "Una propuesta de respuesta ideal en primera persona (yo) basada en su perfil real, lista para decir en voz alta."
    }
  ]
}

Sobre "indicators": son SIEMPRE esos 5 nombres exactos (Claridad, Estructura, Fit con el puesto, Confianza, Comunicación), cada uno con un score 0-100 honesto. Cada pregunta lleva también su "score" 0-100 individual.
Sobre "level": una etiqueta corta (1-2 palabras) del nivel general acorde al score (ej. "Inicial", "En desarrollo", "Sólido", "Muy sólido", "Sobresaliente").
Sobre "verdict": UNA sola oración con el desenlace simulado de esta entrevista para ESTE puesto ("avanzarías a la siguiente ronda", "quedarías en duda", "todavía no avanzarías"), basada en las respuestas reales. Honesta pero motivadora, en segunda persona (vos).
Sobre "topPriority" y "nextStep": la mejora de MAYOR impacto (una sola, la que más mueve la aguja) y un paso concreto para lograrla. No repitas la lista de "improvements": esto es LA prioridad.

SEÑAL DE VOZ (esto es una entrevista HABLADA, no escrita — aprovechalo):
- Las respuestas son transcripciones de habla real. Evaluá la ENTREGA, no solo el contenido: muletillas ("eh", "este", "o sea", "digamos", "nada"), respuestas demasiado cortas o cortadas, divagues, falta de concreción.
- El indicador "Comunicación" mide esto (fluidez, concisión, seguridad al hablar). Mencioná en el análisis lo que notes de la entrega (ej. "usaste 'eh' un montón, se nota el nervio").
- Si una respuesta dice "(No respondí a esta pregunta)", trátala como que el candidato se quedó en blanco: bajá su score y dale una estrategia para cuando no sepa qué decir.

RÚBRICA SEGÚN TIPO DE ENTREVISTA (## TIPO DE ENTREVISTA):
- Técnica: pesá profundidad y correctitud técnica; marcá vaguedad o errores conceptuales.
- Comportamiento (STAR): evaluá si estructuró Situación-Tarea-Acción-Resultado; señalá si falta el Resultado o los números.
- HR / General: pesá fit cultural, motivación y claridad del relato.
Adaptá el análisis y los ejemplos al tipo, aunque los 5 indicadores se mantengan.

VOZ Y PERSONALIDAD (aplicá a summary, strengths, improvements, analysis, suggestion y verdict):
- Sos "El Loro" 🦜: un coach atrevido, cercano y confianzudo, que le habla al candidato como un amigo que lo quiere ver ganar. Un toque de humor de loro.
- Confianzudo NO es blando: sé directo y sin vueltas cuando algo estuvo flojo, pero siempre desde el cariño y empujando para arriba. Podés picantear con cariño.
- Nada de corporativo ni acartonado. Frases cortas y claras. Cero "estimado candidato", cero relleno de RRHH.
- El rigor no se negocia: el análisis es concreto, honesto y accionable. La personalidad es el envoltorio, no una excusa para ser impreciso ni para regalar elogios.
- Si el reporte es en español rioplatense (Argentina): usá voseo natural (tenés, fijate, contá), pero con un tono más neutro y profesional. NO uses "che" ni lunfardo/modismos marcados: cálido y directo, pero sobrio, no exageradamente porteño.
- Si el reporte es en inglés: escribí en inglés natural y coloquial (un coach cercano, no corporate), SIN traducir literalmente modismos rioplatenses ni mezclar español.

Reglas críticas:
- Sé honesto pero motivador. Valora la señal técnica, el fit cultural y la comunicación.
- Si una pregunta del entrevistador es un pedido de completar o aclarar la respuesta anterior (una repregunta de continuidad, ej. "¿querés terminar la idea?"), integrá esa respuesta al análisis de la pregunta original en vez de evaluarla como una pregunta separada. No penalices al candidato por un corte técnico.
- No inventes logros que no estén en el perfil del candidato.
- IDIOMA: escribí absolutamente TODO el reporte —cada campo de texto, sin excepción (summary, verdict, level, topPriority, nextStep, strengths, improvements, y el analysis/suggestion de cada pregunta)— en el idioma indicado en "## IDIOMA DEL REPORTE". Ni una palabra en otro idioma, aunque el historial de la entrevista esté en otro idioma.
- Devuelve ÚNICAMENTE el objeto JSON válido. No uses bloques de código Markdown como \`\`\`json ni texto explicativo antes o después. Devuelve solo las llaves del JSON.`;

// Cadena de intentos: el modelo pedido y después el estable del mismo provider.
function fallbackChain(spec: ModelSpec): ModelSpec[] {
  const STABLE: Record<Provider, string> = {
    gemini: "gemini-2.5-flash",
    openai: "gpt-4.1-mini",
    anthropic: "claude-haiku-4-5",
  };
  const stableId = STABLE[spec.provider];
  if (spec.model === stableId) return [spec];
  return [spec, specForRequest(spec.provider, stableId)];
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

  const rl = rateLimit(req, "simulador", 30, 60_000);
  if (!rl.ok) {
    return new Response("Demasiadas solicitudes. Esperá un momento.", {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfter) },
    });
  }

  let body: {
    action?: "next-question" | "feedback" | "closing";
    profile?: string;
    company?: string;
    role?: string;
    interviewType?: string;
    answerLang?: string;
    provider?: string;
    model?: string;
    history?: Array<{ question: string; answer: string; recovery?: boolean }>;
    questionIndex?: number;
    questionsCount?: number;
    lastAnswerLikelyCut?: boolean;
    image?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Body inválido.", { status: 400 });
  }

  const action = body.action || "next-question";
  const provider: Provider =
    body.provider === "anthropic" || body.provider === "openai" ? body.provider : "gemini";
  const spec = specForRequest(provider, (body.model || "").slice(0, 100));

  const profile = (body.profile || "").slice(0, 8000);
  const company = (body.company || "").slice(0, 200);
  const role = (body.role || "").slice(0, 2000);
  const interviewType = (body.interviewType || "General").slice(0, 100);
  const answerLang = body.answerLang === "en" ? "en" : "es";

  // Truncar cada turno: respuestas dictadas muy largas inflan tokens y la
  // latencia del feedback (que tiene que entrar en los 25s de Edge).
  const history = (body.history || []).slice(0, 20).map((h) => ({
    question: String(h?.question || "").slice(0, 600),
    answer: String(h?.answer || "").slice(0, 2500),
    recovery: !!h?.recovery,
  }));
  // Los turnos de rescate no llevan número de pregunta: si lo llevaran, el
  // modelo leería "Pregunta 4" mientras el progreso le dice que va por la 2, y
  // empezaría a cerrar la entrevista antes de tiempo.
  let nQ = 0;
  const historyText =
    history.length > 0
      ? history
          .map((h) => {
            if (h.recovery) {
              return `(Repregunta para completar la respuesta ${nQ}): ${h.question}\nContinuación: ${h.answer}`;
            }
            nQ += 1;
            return `Pregunta ${nQ}: ${h.question}\nRespuesta ${nQ}: ${h.answer}`;
          })
          .join("\n\n")
      : "(Aún no comenzó la entrevista)";

  const qIndex = Math.max(1, Math.min(50, Number(body.questionIndex) || history.length + 1));
  const qCount = Math.max(0, Math.min(20, Number(body.questionsCount) || 0));
  const progressText = qCount
    ? `Esta es la pregunta ${qIndex} de ${qCount}.${qIndex >= qCount ? " Es la ÚLTIMA pregunta de la entrevista." : ""}`
    : "(sin límite definido)";

  const isFeedback = action === "feedback";
  const isClosing = action === "closing";

  const answerLangLabel = isFeedback
    ? answerLang === "en"
      ? "Inglés (English). Escribí TODO el reporte —cada campo de texto, sin excepción— en inglés."
      : "Español rioplatense (Argentina). Escribí todo el reporte con voseo natural pero en un tono neutro y profesional, SIN \"che\" ni lunfardo marcado."
    : answerLang === "en"
      ? "Inglés (English). Formula tus preguntas en inglés."
      : "Español rioplatense (Argentina). Formulá tus preguntas con voseo (vos, contame, tenés), como un entrevistador porteño.";

  const userContent = `## EMPRESA
${company || "(sin especificar)"}

## DESCRIPCIÓN DEL PUESTO
${role || "(sin especificar)"}

## PERFIL DEL CANDIDATO
${profile || "(sin perfil cargado)"}

## TIPO DE ENTREVISTA
${interviewType}

## PROGRESO
${progressText}

## ${isFeedback ? "IDIOMA DEL REPORTE" : "IDIOMA DE LA RESPUESTA"}
${answerLangLabel}
${!isFeedback && body.lastAnswerLikelyCut ? `
## SEÑAL DEL SISTEMA
La última respuesta del candidato pudo haberse cortado por un problema técnico de transcripción (quedó a mitad de idea).
` : ""}${isClosing ? `
## CIERRE
La entrevista TERMINÓ. Este es tu último turno: despedite (ver la regla de CIERRE).
` : ""}
## HISTORIAL DE LA ENTREVISTA
${historyText}`;
  const systemPrompt = isFeedback ? SYSTEM_PROMPT_FEEDBACK : SYSTEM_PROMPT_INTERVIEWER;

  // Frame opcional de la cámara del candidato (data URL JPEG chico) para que
  // el entrevistador "lo vea". Solo se usa en next-question y solo con Gemini.
  let image: { mimeType: string; data: string } | null = null;
  if (!isFeedback && typeof body.image === "string" && body.image.length < 400_000) {
    const m = body.image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (m) image = { mimeType: m[1], data: m[2] };
  }

  const candidates = fallbackChain(spec);

  try {
    if (isFeedback) {
      return await getFeedback(provider, candidates, systemPrompt, userContent);
    } else {
      if (provider === "anthropic") return await streamAnthropic(candidates, systemPrompt, userContent);
      if (provider === "openai") return await streamOpenAI(candidates, systemPrompt, userContent);
      return await streamGemini(candidates, systemPrompt, userContent, image);
    }
  } catch (err: any) {
    console.error(`[simulador] excepción con ${provider}/${spec.model}:`, err?.message || err);
    return new Response(`Error del modelo ${spec.model}: ${err?.message || "desconocido"}`, {
      status: 502,
    });
  }
}

/** Cuánto se lee esperando la marca antes de darse por vencido. */
const MARK_PEEK_CHARS = 24;

/**
 * Saca la marca #NUEVA/#MISMA de la primera línea y la devuelve como header.
 *
 * Va acá y no en el cliente porque el texto se manda al sintetizador de voz a
 * medida que llega: si la marca sobreviviera un solo chunk, el entrevistador
 * diría "numeral nueva" en voz alta. Del lado del cliente nunca existe.
 *
 * Si el modelo se olvida de marcar, se asume tema nuevo — que es exactamente el
 * comportamiento que había antes de existir la marca.
 *
 * `x-loro-model` deja registrado qué modelo respondió de verdad (para saber si
 * entró un fallback).
 */
async function textStreamResponse(stream: ReadableStream, model: string) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  // Se espía solo el arranque: lo justo para ver la marca sin retrasar la voz.
  let head = "";
  let upstreamDone = false;
  while (head.length < MARK_PEEK_CHARS && !head.includes("\n")) {
    const { done, value } = await reader.read();
    if (done) {
      upstreamDone = true;
      break;
    }
    head += decoder.decode(value, { stream: true });
  }

  let nueva = true;
  const m = head.match(/^\s*#(NUEVA|MISMA)\b[ \t]*\r?\n?/i);
  if (m) {
    nueva = m[1].toUpperCase() === "NUEVA";
    head = head.slice(m[0].length);
  }

  const rest = new ReadableStream({
    async pull(controller) {
      if (head) {
        controller.enqueue(encoder.encode(head));
        head = "";
        return;
      }
      if (upstreamDone) {
        controller.close();
        return;
      }
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });

  return new Response(rest, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "x-loro-model": model,
      // 1 = abre un tema nuevo (consume una de las preguntas de la entrevista).
      "x-loro-nueva": nueva ? "1" : "0",
    },
  });
}

function sseTextStream(
  upstream: ReadableStream<Uint8Array>,
  extract: (json: string) => string | null
): ReadableStream {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.getReader();
  let buffer = "";
  return new ReadableStream({
    // El pull loopea hasta encolar datos reales: si resuelve sin encolar,
    // Vercel Edge puede pausar el stream y la sala queda colgada.
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
            // fragmento incompleto: se ignora
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

async function streamGemini(
  specs: ModelSpec[],
  systemPrompt: string,
  userContent: string,
  image?: { mimeType: string; data: string } | null
): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response("Falta GEMINI_API_KEY en las variables de entorno.", { status: 500 });
  }
  let detail = "";
  let status = 502;
  let lastModel = "";
  for (const spec of specs) {
    lastModel = spec.model;
    const upstream = await fetch(geminiUrl(spec.model, "streamGenerateContent", apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        geminiBody({
          spec,
          system: systemPrompt,
          user: userContent,
          maxOutputTokens: 512,
          temperature: 0.5,
          image,
        })
      ),
    });
    if (upstream.ok && upstream.body) {
      if (spec !== specs[0]) console.warn(`[simulador] fallback a ${spec.model}`);
      return await textStreamResponse(
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

async function streamAnthropic(specs: ModelSpec[], systemPrompt: string, userContent: string): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      "Falta ANTHROPIC_API_KEY para usar Claude. Cargá el token o elegí otro modelo.",
      { status: 500 }
    );
  }
  let detail = "";
  let status = 502;
  let lastModel = "";
  for (const spec of specs) {
    lastModel = spec.model;
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: ANTHROPIC_HEADERS(apiKey),
      body: JSON.stringify(
        anthropicBody({
          spec,
          system: systemPrompt,
          user: userContent,
          maxTokens: 512,
          temperature: 0.5,
          stream: true,
        })
      ),
    });
    if (upstream.ok && upstream.body) {
      if (spec !== specs[0]) console.warn(`[simulador] fallback a ${spec.model}`);
      return await textStreamResponse(
        sseTextStream(upstream.body, (json) => {
          const evt = JSON.parse(json);
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

async function streamOpenAI(specs: ModelSpec[], systemPrompt: string, userContent: string): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      "Falta OPENAI_API_KEY para usar GPT. Cargá el token o elegí otro modelo.",
      { status: 500 }
    );
  }
  let detail = "";
  let status = 502;
  let lastModel = "";
  for (const spec of specs) {
    lastModel = spec.model;
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(
        openaiBody({
          spec,
          system: systemPrompt,
          user: userContent,
          maxTokens: spec.reasoning ? 900 : 512,
          temperature: 0.5,
          stream: true,
        })
      ),
    });
    if (upstream.ok && upstream.body) {
      if (spec !== specs[0]) console.warn(`[simulador] fallback a ${spec.model}`);
      return await textStreamResponse(
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

// Los modelos a veces desobedecen y envuelven el JSON en fences ```json ...```
// o le anteponen texto: limpiar antes de parsear para no tirar el reporte.
function parseModelJson(text: string): unknown {
  const cleaned = (text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("JSON inválido del modelo");
  }
}

// El reporte necesita margen de tokens: con 5 preguntas, 2048 truncaba el JSON
// y el parseo fallaba. Vale para los tres proveedores, no solo para Gemini.
//
// Es el presupuesto de la respuesta VISIBLE: a los modelos que piensan (Gemini
// 3.x, los de razonamiento de OpenAI) los builders de lib/llm.ts les suman
// aparte el margen que se va a comer el pensamiento.
const FEEDBACK_MAX_TOKENS = 4096;

/**
 * El texto crudo del modelo convertido en informe, o una excepción.
 *
 * Antes cada proveedor hacía `parseModelJson(texto || "{}")`, y ese `|| "{}"`
 * escondía el peor final posible: si el modelo no llegaba a escribir nada, el
 * `{}` parseaba perfecto y se devolvía un 200 con un informe VACÍO. El
 * candidato terminaba su entrevista y veía un reporte en blanco con puntaje 0,
 * sin ningún error — y el modelo de respaldo no se probaba nunca, porque para
 * el código había salido todo bien.
 *
 * Tratarlo como falla es lo que hace que la cadena de respaldo sirva para algo
 * en el caso en que más falta hace.
 */
function reporteDeTexto(texto: string | undefined): unknown {
  const t = (texto || "").trim();
  if (!t) throw new Error("el modelo devolvió una respuesta vacía");
  const r = parseModelJson(t) as Record<string, unknown> | null;
  // Parsear no alcanza: un objeto sin ninguno de los campos que sostienen el
  // informe es tan inservible como no haber contestado, y conviene gastar el
  // respaldo antes que entregarlo.
  const tieneAlgo =
    !!r &&
    typeof r === "object" &&
    (typeof r.score === "number" || typeof r.summary === "string" || Array.isArray(r.questions));
  if (!tieneAlgo) throw new Error("el informe vino incompleto");
  return r;
}

/**
 * Presupuesto de tiempo del informe.
 *
 * Esto corre en el runtime edge, que corta la función alrededor de los 25s. El
 * informe NO va en streaming —se espera el JSON completo—, así que si el modelo
 * tarda, la plataforma mata la función en el medio: el navegador recibe un
 * error sin cuerpo y no hay forma de saber qué pasó. Peor: al fallar un modelo
 * se probaba el siguiente, sumando su tiempo al del anterior, así que la cadena
 * de respaldo hacía MÁS probable el corte en vez de menos.
 *
 * Con un presupuesto compartido, el corte lo damos nosotros y con un mensaje
 * que se entiende, antes de que lo dé la plataforma sin decir nada.
 */
/*
 * 12s no alcanzaban: armar el informe completo en JSON son varios miles de
 * tokens y el modelo se pasaba, así que cortábamos nosotros un pedido que
 * habría terminado bien. Un intento que llega vale más que dos que mueren
 * dentro del límite de la plataforma, así que el intento se lleva casi todo
 * el presupuesto y el respaldo solo entra si el primero falla rápido.
 */
const FEEDBACK_PRESUPUESTO_MS = 22_000;
const FEEDBACK_INTENTO_MS = 21_000;

async function pedirConTope(
  url: string,
  init: RequestInit,
  topeMs: number
): Promise<{ res?: Response; error?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), topeMs);
  try {
    return { res: await fetch(url, { ...init, signal: ctrl.signal }) };
  } catch (e: any) {
    return {
      error:
        e?.name === "AbortError"
          ? `el modelo tardó más de ${Math.round(topeMs / 1000)}s en armar el informe`
          : `no se pudo llegar al modelo: ${e?.message || e}`,
    };
  } finally {
    clearTimeout(t);
  }
}

async function getFeedback(
  provider: Provider,
  specs: ModelSpec[],
  systemPrompt: string,
  userContent: string
): Promise<Response> {
  // Reloj compartido por todos los intentos: el respaldo no puede sumar tiempo
  // hasta que la plataforma corte la función sin avisar.
  const limite = Date.now() + FEEDBACK_PRESUPUESTO_MS;
  const restante = () => Math.min(limite - Date.now(), FEEDBACK_INTENTO_MS);

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return new Response("Falta OPENAI_API_KEY.", { status: 500 });
    let detail = "";
    let status = 502;
    let lastModel = "";
    for (const spec of specs) {
      lastModel = spec.model;
      const queda = restante();
      if (queda < 3000) {
        detail = detail || "se acabó el tiempo disponible para armar el informe";
        break;
      }
      // Igual que en streaming: los modelos de razonamiento necesitan
      // max_completion_tokens y esfuerzo bajo, o se comen el límite de 25s
      // de Edge razonando.
      const intento = await pedirConTope(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(
            openaiBody({
              spec,
              system: systemPrompt,
              user: userContent,
              maxTokens: FEEDBACK_MAX_TOKENS,
              temperature: 0.2,
              json: true,
            })
          ),
        },
        queda
      );
      // Se agotó el tiempo: probar otro modelo solo empeoraría el retraso.
      if (!intento.res) {
        detail = intento.error || "";
        console.error(`[simulador] feedback openai/${spec.model}: ${detail}`);
        break;
      }
      const res = intento.res;
      if (res.ok) {
        const j = await res.json();
        try {
          return Response.json(reporteDeTexto(j.choices?.[0]?.message?.content));
        } catch (e: any) {
          detail = e?.message || "JSON inválido del modelo";
          // `finish_reason` es la pista que separa "el modelo escribió
          // cualquier cosa" de "se quedó sin presupuesto de tokens": con
          // "length" el problema es el techo, no el prompt.
          console.error(
            `[simulador] feedback openai/${spec.model}: ${detail} (finish_reason: ${j.choices?.[0]?.finish_reason || "?"})`
          );
          continue;
        }
      }
      status = res.status;
      detail = await res.text().catch(() => "");
      logUpstream("openai", spec.model, status, detail);
    }
    return new Response(upstreamMessage("openai", lastModel, status, detail), { status: 502 });
  }

  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return new Response("Falta ANTHROPIC_API_KEY.", { status: 500 });
    let detail = "";
    let status = 502;
    let lastModel = "";
    for (const spec of specs) {
      lastModel = spec.model;
      const queda = restante();
      if (queda < 3000) {
        detail = detail || "se acabó el tiempo disponible para armar el informe";
        break;
      }
      const intento = await pedirConTope(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: ANTHROPIC_HEADERS(apiKey),
          body: JSON.stringify(
            anthropicBody({
              spec,
              system: systemPrompt,
              user: userContent,
              maxTokens: FEEDBACK_MAX_TOKENS,
              temperature: 0.2,
            })
          ),
        },
        queda
      );
      if (!intento.res) {
        detail = intento.error || "";
        console.error(`[simulador] feedback anthropic/${spec.model}: ${detail}`);
        break;
      }
      const res = intento.res;
      if (res.ok) {
        const j = await res.json();
        try {
          // anthropicText busca el primer bloque de texto: leer content[0]
          // devolvía vacío si el modelo emitía otro bloque antes.
          return Response.json(reporteDeTexto(anthropicText(j)));
        } catch (e: any) {
          detail = e?.message || "JSON inválido del modelo";
          console.error(
            `[simulador] feedback anthropic/${spec.model}: ${detail} (stop_reason: ${j?.stop_reason || "?"})`
          );
          continue;
        }
      }
      status = res.status;
      detail = await res.text().catch(() => "");
      logUpstream("anthropic", spec.model, status, detail);
    }
    return new Response(upstreamMessage("anthropic", lastModel, status, detail), { status: 502 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return new Response("Falta GEMINI_API_KEY.", { status: 500 });
  let detail = "";
  let status = 502;
  let lastModel = "";
  for (const spec of specs) {
    lastModel = spec.model;
    const queda = restante();
    if (queda < 3000) {
      detail = detail || "se acabó el tiempo disponible para armar el informe";
      break;
    }
    const intento = await pedirConTope(
      geminiUrl(spec.model, "generateContent", apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          geminiBody({
            spec,
            system: systemPrompt,
            user: userContent,
            maxOutputTokens: FEEDBACK_MAX_TOKENS,
            temperature: 0.2,
            json: true,
          })
        ),
      },
      queda
    );
    if (!intento.res) {
      detail = intento.error || "";
      console.error(`[simulador] feedback gemini/${spec.model}: ${detail}`);
      break;
    }
    const res = intento.res;
    if (res.ok) {
      const j = await res.json();
      try {
        return Response.json(reporteDeTexto(j.candidates?.[0]?.content?.parts?.[0]?.text));
      } catch (e: any) {
        detail = e?.message || "JSON inválido del modelo";
        console.error(
          `[simulador] feedback gemini/${spec.model}: ${detail} (finishReason: ${j.candidates?.[0]?.finishReason || "?"})`
        );
        continue;
      }
    }
    status = res.status;
    detail = await res.text().catch(() => "");
    logUpstream("gemini", spec.model, status, detail);
  }
  return new Response(upstreamMessage("gemini", lastModel, status, detail), { status: 502 });
}

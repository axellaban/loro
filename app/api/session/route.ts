export const runtime = "edge";

import { rateLimit, sameOriginStrict } from "../../lib/ratelimit";
import { specForRequest, type Provider } from "../../lib/models";
import { fallbackChain, streamLLM } from "../../lib/stream";
import type { Turn } from "../../lib/llm";

// Trabajo sobre una sesión YA terminada: notas y chat sobre el transcript.
// Nada de esto corre en vivo, así que puede pensar más y escribir más largo que
// /api/answer — el límite de allá está puesto por la latencia de la entrevista.

const NOTES_PROMPT = `Sos un coach de entrevistas leyendo la transcripción de una entrevista de trabajo que ya terminó. La persona que te lee es el CANDIDATO, y quiere sacarle jugo a lo que pasó.

Escribí notas en Markdown con estas secciones, en este orden y con estos títulos exactos:

## Resumen
Dos o tres oraciones: de qué se trató la entrevista y cómo viene la cosa.

## Lo que preguntaron
Las preguntas reales del entrevistador, en viñetas, agrupadas por tema. Usá las palabras del entrevistador, no las parafrasees de más.

## Señales sobre el puesto y la empresa
Todo lo que el entrevistador reveló sin que se lo pregunten: prioridades del equipo, problemas que tienen, cómo es el proceso, qué parece importarles. Si no reveló nada, decilo en una línea en vez de inventar.

## Para mejorar
Dos a cuatro puntos concretos y accionables sobre las respuestas. Nada de generalidades tipo "ser más claro": decí en qué respuesta y qué le faltó.

## Próximos pasos
Qué conviene preparar antes de la próxima instancia.

Reglas:
- Basate SOLO en la transcripción. Si algo no está, no lo inventes ni lo supongas.
- La transcripción viene de reconocimiento de voz automático: puede tener palabras mal transcritas. Interpretá con criterio, no cites errores obvios al pie de la letra.
- Directo y sin relleno. Nada de "En esta entrevista pudimos observar que...".`;

const CHAT_PROMPT = `Sos el asistente del candidato, y tenés la transcripción completa de una entrevista de trabajo que ya terminó. Respondés preguntas sobre esa entrevista.

Reglas:
- Basate SOLO en la transcripción. Si te preguntan algo que no está ahí, decilo en una línea y ofrecé lo más cercano que sí esté.
- La transcripción viene de reconocimiento de voz automático: interpretá con criterio en vez de citar errores obvios al pie de la letra.
- Si te piden redactar algo (un mail de seguimiento, por ejemplo), entregá el texto listo para usar, sin preámbulo.
- Si te piden puntuar o evaluar, dá una nota y justificala con momentos concretos de la transcripción.
- Markdown cuando ayude (viñetas, negritas). Directo, sin relleno.
- Respondé en el idioma que te indiquen abajo.`;

export async function POST(req: Request) {
  if (!sameOriginStrict(req)) {
    return new Response("Origen no permitido.", { status: 403 });
  }
  // Endpoint pago pero de uso pausado (post-entrevista): 12 por minuto cubre
  // de sobra a una persona escribiendo y corta el abuso automatizado.
  const rl = rateLimit(req, "session", 12, 60_000);
  if (!rl.ok) {
    return new Response("Demasiadas solicitudes. Esperá un momento.", {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfter) },
    });
  }

  let body: {
    action?: string;
    transcript?: string;
    question?: string;
    history?: { role?: string; text?: string }[];
    company?: string;
    role?: string;
    lang?: string;
    provider?: string;
    model?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Body inválido.", { status: 400 });
  }

  const action = body.action === "chat" ? "chat" : "notes";
  const provider: Provider =
    body.provider === "anthropic" || body.provider === "openai" ? body.provider : "gemini";
  const spec = specForRequest(provider, (body.model || "").slice(0, 100));

  const transcript = (body.transcript || "").slice(0, 24_000);
  if (transcript.trim().length < 20) {
    return new Response("La sesión no tiene transcripción suficiente.", { status: 400 });
  }
  const company = (body.company || "").slice(0, 200);
  const role = (body.role || "").slice(0, 2000);
  const langLabel =
    body.lang === "en" ? "Inglés (English)." : "Español rioplatense.";

  const context = `## EMPRESA
${company || "(sin especificar)"}

## PUESTO
${role || "(sin especificar)"}

## IDIOMA DE LA RESPUESTA
${langLabel}

## TRANSCRIPCIÓN DE LA ENTREVISTA
${transcript}`;

  if (action === "notes") {
    return streamLLM({
      specs: fallbackChain(spec),
      system: NOTES_PROMPT,
      user: context,
      // Las notas son un documento entero, no una respuesta hablada: el tope de
      // /api/answer (512) las cortaría a la mitad.
      maxTokens: 2048,
      reasoningMaxTokens: 3000,
      temperature: 0.3,
      tag: "session-notes",
    });
  }

  const question = (body.question || "").slice(0, 2000);
  if (!question.trim()) return new Response("Falta la pregunta.", { status: 400 });

  // Los turnos previos van como historial real de la conversación, no
  // concatenados dentro del prompt: así el modelo distingue quién dijo qué.
  // El contexto de la entrevista viaja en el primer turno para no repetir la
  // transcripción entera en cada mensaje.
  const prior = (body.history || [])
    .slice(-12)
    .filter((t) => t && typeof t.text === "string" && t.text.trim())
    .map<Turn>((t) => ({
      role: t.role === "assistant" ? "assistant" : "user",
      text: String(t.text).slice(0, 4000),
    }));

  const history: Turn[] = [
    { role: "user", text: context },
    { role: "assistant", text: "Leí la transcripción. Preguntame lo que quieras sobre esta entrevista." },
    ...prior,
  ];

  return streamLLM({
    specs: fallbackChain(spec),
    system: CHAT_PROMPT,
    user: question,
    history,
    maxTokens: 1536,
    reasoningMaxTokens: 2400,
    temperature: 0.4,
    tag: "session-chat",
  });
}

export const runtime = "edge";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SYSTEM_PROMPT = `Sos EL ENTREVISTADO. No sos un asistente que aconseja: sos la persona que está en la llamada respondiendo en primera persona, en vivo, ahora mismo.

Recibís:
1. EMPRESA y PUESTO al que se está postulando (el contexto de la entrevista).
2. El PERFIL de la persona (su CV, experiencia, logros, notas).
3. La transcripción reciente de la conversación.
4. La última pregunta detectada, marcada como [PREGUNTA].

Tu tarea: responder esa pregunta como si fueras vos el candidato, de la mejor forma posible — una respuesta "10/10" para ESE puesto en ESA empresa específicamente. Usá el perfil para anclar todo en hechos reales (proyectos, resultados, números, tecnologías) y conectalo con lo que la empresa y el rol necesitan. Nunca inventes datos, títulos, empresas o números que no estén en el perfil — si falta un dato concreto, respondé en términos generales pero igual de seguros, sin inventar.

Criterios de una respuesta 10/10:
- Directa: contesta lo que se preguntó, sin rodeos ni relleno.
- Específica: con ejemplos o números reales del perfil, no genérica.
- Relevante al puesto y a la empresa: si la pregunta es técnica, foco técnico; si es de comportamiento, usá estructura STAR (situación breve, acción, resultado); si es "por qué esta empresa" o "por qué este rol", conectá el perfil con lo que la empresa hace.
- Segura y natural: como si el candidato lo tuviera clarísimo, sin sonar ensayado.
- Cerrada: termina con una idea fuerte, no se queda a medias.

Formato de salida (esto es CLAVE para que sirva en vivo, con el candidato leyendo mientras habla):
- 3 a 5 bullets cortos.
- Cada bullet es una frase completa, lista para decir en voz alta tal cual, en primera persona ("Lideré...", "Implementé...", "Elegiría..."). No son "ideas para desarrollar", son la respuesta misma.
- Sin preámbulo, sin "Podrías decir", sin "aquí está tu respuesta": arrancá directo con el primer bullet.
- Mismo idioma que la conversación.
- Si todavía no hay pregunta clara, devolvé un solo bullet: "· (esperando pregunta)".`;

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response("Falta GEMINI_API_KEY en las variables de entorno.", {
      status: 500,
    });
  }

  let body: {
    profile?: string;
    company?: string;
    role?: string;
    transcript?: string;
    question?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Body inválido.", { status: 400 });
  }

  const profile = (body.profile || "").slice(0, 8000);
  const company = (body.company || "").slice(0, 200);
  const role = (body.role || "").slice(0, 200);
  const transcript = (body.transcript || "").slice(0, 6000);
  const question = (body.question || "").slice(0, 1000);

  const userContent = `## EMPRESA
${company || "(sin especificar)"}

## PUESTO AL QUE SE POSTULA
${role || "(sin especificar)"}

## PERFIL DEL CANDIDATO
${profile || "(sin perfil cargado)"}

## TRANSCRIPCIÓN RECIENTE
${transcript || "(vacío)"}

## ÚLTIMO PUNTO DETECTADO
[PREGUNTA] ${question || "(ninguna aún)"}`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: userContent,
          },
        ],
      },
    ],
    systemInstruction: {
      parts: [
        {
          text: SYSTEM_PROMPT,
        },
      ],
    },
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 400,
      // Desactiva el "thinking" extendido de 2.5 Flash: sin esto Gemini piensa
      // varios cientos de ms antes del primer token, y en vivo eso se nota.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return new Response(`Gemini error: ${detail}`, { status: 502 });
  }

  // Reenvía solo el texto de los candidatos de la API de Gemini como stream plano.
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();
  let buffer = "";

  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const json = trimmed.slice(5).trim();
        if (!json) continue;
        try {
          const evt = JSON.parse(json);
          const text = evt.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        } catch {
          // ignora fragmentos incompletos
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

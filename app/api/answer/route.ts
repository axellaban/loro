export const runtime = "edge";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SYSTEM_PROMPT = `Sos un copiloto en tiempo real que asiste a una persona durante una llamada en vivo (entrevista, discovery call o reunión).

Recibís:
1. El PERFIL de la persona a la que asistís (su CV, experiencia, notas, contexto).
2. La transcripción reciente de la conversación.
3. La última pregunta o punto detectado, marcado como [PREGUNTA].

Tu tarea: generar una respuesta sugerida que la persona pueda decir, en primera persona, apoyada en su perfil real. Nunca inventes datos que no estén en el perfil.

Formato de salida:
- 3 a 5 bullets cortos, cada uno una idea que la persona puede desarrollar al hablar.
- Directo, sin preámbulo, sin "aquí está tu respuesta".
- En el mismo idioma que la conversación.
- Si no hay una pregunta clara todavía, devolvé un solo bullet: "· (esperando pregunta)".`;

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response("Falta GEMINI_API_KEY en las variables de entorno.", {
      status: 500,
    });
  }

  let body: { profile?: string; transcript?: string; question?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Body inválido.", { status: 400 });
  }

  const profile = (body.profile || "").slice(0, 8000);
  const transcript = (body.transcript || "").slice(0, 6000);
  const question = (body.question || "").slice(0, 1000);

  const userContent = `## PERFIL DE LA PERSONA
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
            text: userContent
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: SYSTEM_PROMPT
        }
      ]
    },
    generationConfig: {
      temperature: 0.3
    }
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


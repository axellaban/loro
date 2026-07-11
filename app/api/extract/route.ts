export const runtime = "edge";

// Extrae empresa + descripción del puesto desde un aviso de trabajo pegado.
// Usa Gemini (mismo key que ya está configurado) en modo JSON, no streaming.
const MODEL = process.env.GEMINI_EXTRACT_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";

function sameOriginOk(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const SYSTEM = `Sos un extractor. Recibís el texto crudo de un aviso de trabajo (job post) y devolvés SOLO un JSON con dos campos:
- "company": el nombre de la empresa que contrata (string corto). Si no aparece, "".
- "role": una descripción concisa del puesto en 2-5 líneas: título del rol + responsabilidades y requisitos clave, en el mismo idioma del aviso. No inventes nada que no esté en el texto.
Devolvé únicamente el JSON, sin markdown ni explicaciones.`;

export async function POST(req: Request) {
  if (!sameOriginOk(req)) {
    return new Response("Origen no permitido.", { status: 403 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response("Falta GEMINI_API_KEY en las variables de entorno.", { status: 500 });
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Body inválido.", { status: 400 });
  }
  const text = (body.text || "").slice(0, 12000).trim();
  if (!text) {
    return new Response("Pegá el aviso primero.", { status: 400 });
  }

  const payload = {
    contents: [{ role: "user", parts: [{ text: `AVISO:\n${text}` }] }],
    systemInstruction: { parts: [{ text: SYSTEM }] },
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 600,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return new Response(`No se pudo leer el aviso: ${detail}`, { status: 502 });
  }

  const data = await upstream.json().catch(() => null);
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  let parsed: { company?: string; role?: string } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Por si el modelo envolvió el JSON en texto: rescatamos el primer objeto.
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        return new Response("No pude interpretar el aviso. Cargá los campos a mano.", { status: 502 });
      }
    } else {
      return new Response("No pude interpretar el aviso. Cargá los campos a mano.", { status: 502 });
    }
  }

  return Response.json({
    company: typeof parsed.company === "string" ? parsed.company : "",
    role: typeof parsed.role === "string" ? parsed.role : "",
  });
}

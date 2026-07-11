export const runtime = "edge";

// Diagnóstico: lista los IDs de modelo REALES disponibles para cada key
// configurada. Sirve para saber el string exacto que hay que usar por API
// (el nombre visible en las UIs no suele ser el ID real). No expone las keys:
// solo devuelve nombres de modelo.
export async function GET() {
  const out: Record<string, unknown> = {};

  // OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    out.openai = "sin OPENAI_API_KEY";
  } else {
    try {
      const r = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${openaiKey}` },
      });
      if (!r.ok) {
        out.openai = `error ${r.status}: ${(await r.text()).slice(0, 300)}`;
      } else {
        const j = await r.json();
        out.openai = (j.data || [])
          .map((m: any) => m.id)
          .filter((id: string) => /gpt|o[0-9]|chat/i.test(id))
          .sort();
      }
    } catch (e: any) {
      out.openai = `fetch falló: ${e?.message}`;
    }
  }

  // Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    out.anthropic = "sin ANTHROPIC_API_KEY";
  } else {
    try {
      const r = await fetch("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
      });
      if (!r.ok) {
        out.anthropic = `error ${r.status}: ${(await r.text()).slice(0, 300)}`;
      } else {
        const j = await r.json();
        out.anthropic = (j.data || []).map((m: any) => m.id).sort();
      }
    } catch (e: any) {
      out.anthropic = `fetch falló: ${e?.message}`;
    }
  }

  // Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    out.gemini = "sin GEMINI_API_KEY";
  } else {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}&pageSize=100`
      );
      if (!r.ok) {
        out.gemini = `error ${r.status}: ${(await r.text()).slice(0, 300)}`;
      } else {
        const j = await r.json();
        out.gemini = (j.models || [])
          .map((m: any) => String(m.name || "").replace(/^models\//, ""))
          .filter((id: string) => /gemini/i.test(id))
          .sort();
      }
    } catch (e: any) {
      out.gemini = `fetch falló: ${e?.message}`;
    }
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

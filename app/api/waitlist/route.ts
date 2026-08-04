export const runtime = "edge";

import { rateLimit, sameOriginStrict } from "../../lib/ratelimit";
import { registrarEmail } from "../../lib/gform";

// Reenvía el email a un Google Form desde el servidor. A diferencia del submit
// no-cors del navegador (respuesta opaca, siempre "éxito"), acá SÍ leemos el
// status real y devolvemos ok:true/false para no perder leads en silencio.

export async function POST(req: Request) {
  if (!sameOriginStrict(req)) {
    return Response.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  }
  const rl = rateLimit(req, "waitlist", 10, 60_000);
  if (!rl.ok) {
    return Response.json(
      { ok: false, error: "Demasiados intentos. Esperá un momento." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  let email = "";
  try {
    const body = await req.json();
    email = String(body?.email || "").trim();
  } catch {
    return Response.json({ ok: false, error: "Body inválido." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return Response.json({ ok: false, error: "Email inválido." }, { status: 400 });
  }

  const r = await registrarEmail(email);
  if (r.ok) return Response.json({ ok: true });
  return Response.json({ ok: false, error: r.error }, { status: 502 });
}

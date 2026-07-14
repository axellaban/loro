export const runtime = "edge";

import { rateLimit, sameOriginStrict } from "../../lib/ratelimit";

// Reenvía el email a un Google Form desde el servidor. A diferencia del submit
// no-cors del navegador (respuesta opaca, siempre "éxito"), acá SÍ leemos el
// status real y devolvemos ok:true/false para no perder leads en silencio.
// Form y entry-id se pueden pisar por env.
const GFORM_ACTION =
  process.env.GFORM_ACTION ||
  "https://docs.google.com/forms/d/e/1FAIpQLSelOpUf5moBn1tDItWN6Jf37Ky47_4AJwNs5WqiS-E1zL1aqQ/formResponse";
const GFORM_EMAIL_ENTRY = process.env.GFORM_EMAIL_ENTRY || "entry.73601750";

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

  try {
    const r = await fetch(GFORM_ACTION, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ [GFORM_EMAIL_ENTRY]: email }).toString(),
    });
    // Google Forms responde 200 (o redirect que fetch sigue hasta 200) en éxito.
    if (r.status < 400) return Response.json({ ok: true });
    return Response.json(
      { ok: false, error: `No se pudo registrar (HTTP ${r.status}).` },
      { status: 502 }
    );
  } catch {
    return Response.json({ ok: false, error: "Error de red al registrar." }, { status: 502 });
  }
}

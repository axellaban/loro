export const runtime = "edge";

import { rateLimit, sameOriginStrict } from "../../lib/ratelimit";
import { fmtPassExpiry, verifyPass } from "../../lib/pass";

// Diagnóstico: ¿este deploy tiene PASS_SECRET cargado?
//
// En Vercel una variable de entorno nueva NO entra en los deploys que ya
// estaban corriendo: hay que redeployar. Sin esto, un pase que no activa se ve
// igual que uno inválido y no hay forma de saber cuál de los dos es. Devuelve
// solo un booleano, nunca el secreto.
export async function GET() {
  return Response.json({
    pasesConfigurados: !!process.env.PASS_SECRET,
    ayuda: process.env.PASS_SECRET
      ? "Los pases están activos en este deploy."
      : "Falta PASS_SECRET en este deploy. Cargala en Vercel y REDEPLOYÁ: las variables nuevas no entran en un deploy ya hecho.",
  });
}

// Canje y revalidación de un pase. El navegador no puede verificar la firma
// (no tiene el secreto), así que pregunta acá: al pegar el código y después
// cada vez que abre la app, para que un pase vencido deje de valer solo.
export async function POST(req: Request) {
  if (!sameOriginStrict(req)) {
    return Response.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  }
  // La app revalida 1 vez al cargar; 20/min deja lugar a recargas y corta el
  // barrido de códigos a fuerza bruta.
  const rl = rateLimit(req, "pass", 20, 60_000);
  if (!rl.ok) {
    return Response.json(
      { ok: false, error: "Demasiados intentos. Esperá un momento." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const secret = process.env.PASS_SECRET;
  if (!secret) {
    // Sin secreto configurado no se puede validar nada. Es un error de
    // deploy, no de la persona, y se dice así.
    return Response.json(
      { ok: false, error: "Los pases no están configurados en el servidor." },
      { status: 500 }
    );
  }

  let token = "";
  try {
    const body = await req.json();
    token = String(body?.token || "").trim();
  } catch {
    return Response.json({ ok: false, error: "Body inválido." }, { status: 400 });
  }
  if (!token || token.length > 500) {
    return Response.json({ ok: false, error: "Pase inválido." }, { status: 400 });
  }

  const r = await verifyPass(token, secret);
  if (r.ok) {
    return Response.json({
      ok: true,
      email: r.claims.email,
      expiresAt: r.claims.expiresAt,
      plan: r.claims.plan,
    });
  }

  // Mensajes distintos por causa: "venció" y "está mal escrito" se resuelven
  // de maneras muy distintas y la persona ya pagó, así que merece saber cuál es.
  const error =
    r.reason === "expired"
      ? `Tu pase venció el ${fmtPassExpiry(r.expiredAt || 0)}. Escribime y lo renovamos.`
      : "Ese pase no es válido. Revisá que lo hayas copiado entero.";
  return Response.json({ ok: false, error, reason: r.reason }, { status: 400 });
}

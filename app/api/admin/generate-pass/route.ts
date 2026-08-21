import { rateLimit } from "../../../lib/ratelimit";
import { createPass, PLAN_DAYS, type PassPlan, fmtPassExpiry, timingSafeEqual } from "../../../lib/pass";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const SIN_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Content-Type": "application/json; charset=utf-8",
} as const;

/**
 * Genera un pase firmado. Solo para administradores.
 *
 * POST /api/admin/generate-pass
 * Body: { email, days?, plan?, adminToken }
 *
 * days: número de días (1-3650), por defecto 7
 * plan: "week" o "year", ignorado si se especifica days
 * adminToken: token secreto de admin (debe coincidir con ADMIN_PASS_TOKEN)
 */
export async function POST(req: Request) {
  // Sin chequeo de mismo-origen a propósito: este endpoint lo llama un admin
  // desde curl/un script, no el navegador de la app. La autenticación real es
  // el adminToken de abajo.

  // Rate limit: máximo 100 pases/min para evitar spam
  const rl = rateLimit(req, "admin-pass", 100, 60_000);
  if (!rl.ok) {
    return Response.json(
      { ok: false, error: "Demasiados intentos. Esperá un momento." },
      { status: 429, headers: { ...SIN_CACHE, "Retry-After": String(rl.retryAfter) } }
    );
  }

  const secret = process.env.PASS_SECRET;
  const adminToken = process.env.ADMIN_PASS_TOKEN;

  if (!secret || !adminToken) {
    return Response.json(
      { ok: false, error: "El servidor no está configurado correctamente." },
      { status: 500, headers: SIN_CACHE }
    );
  }

  let email = "";
  let days = 7;
  let plan: PassPlan = "week";
  let token = "";

  try {
    const body = await req.json();
    email = String(body?.email || "").trim();
    token = String(body?.adminToken || "");
    plan = body?.plan === "year" ? "year" : "week";

    if (body?.days && /^\d+$/.test(String(body.days))) {
      days = parseInt(String(body.days), 10);
    } else {
      days = PLAN_DAYS[plan];
    }
  } catch {
    return Response.json({ ok: false, error: "Body inválido." }, { status: 400, headers: SIN_CACHE });
  }

  // Validar token de admin
  if (!token || !timingSafeEqual(token, adminToken)) {
    return Response.json(
      { ok: false, error: "Token de admin inválido." },
      { status: 401, headers: SIN_CACHE }
    );
  }

  // Validar email
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json(
      { ok: false, error: "Email inválido." },
      { status: 400, headers: SIN_CACHE }
    );
  }

  // Validar días
  if (!Number.isFinite(days) || days < 1 || days > 3650) {
    return Response.json(
      { ok: false, error: "Los días tienen que ser un número entre 1 y 3650." },
      { status: 400, headers: SIN_CACHE }
    );
  }

  try {
    const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
    const pase = await createPass({ email, expiresAt, plan }, secret);
    const vence = fmtPassExpiry(expiresAt);
    const baseUrl = process.env.LOREADO_URL || "https://loreado.vercel.app";
    const link = `${baseUrl}/app?pase=${encodeURIComponent(pase)}`;

    return Response.json(
      {
        ok: true,
        email,
        dias: days,
        vence,
        codigo: pase,
        link,
        mensaje: `Pase para ${email} — ${days} días, vence el ${vence}`,
      },
      { headers: SIN_CACHE }
    );
  } catch (e) {
    console.error("[admin/generate-pass] error:", e);
    return Response.json(
      { ok: false, error: "Error al generar el pase." },
      { status: 500, headers: SIN_CACHE }
    );
  }
}

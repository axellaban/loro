// Entrar con Google, salir, y saber quién está adentro.
//
//   POST    entrar: recibe el ID token de Google, lo verifica y deja la cookie
//   GET     quién soy (y qué pase tiene mi cuenta)
//   DELETE  salir
//
// Devolver el pase junto con la sesión es el punto de todo esto: quien entra
// desde un dispositivo nuevo recibe su código sin tener que buscarlo en el
// WhatsApp de hace tres meses.

import { rateLimit, sameOriginStrict } from "../../lib/ratelimit";
import { verificarIdToken } from "../../lib/google";
import { pasePorCuenta } from "../../lib/passStore";
import { verifyPass } from "../../lib/pass";
import * as kv from "../../lib/kv";
import {
  cookieBorrada,
  cookieDeSesion,
  crearSesion,
  sesionDeRequest,
  type Sesion,
} from "../../lib/session";

export const runtime = "edge";
/** Nunca cacheado: la respuesta depende de quién pregunta. */
export const dynamic = "force-dynamic";

const SIN_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Content-Type": "application/json; charset=utf-8",
} as const;

/**
 * El pase de una cuenta, ya verificado. Se revalida la firma en vez de confiar
 * en lo que hay guardado: si el pase venció mientras tanto, tiene que dejar de
 * valer solo, igual que en /api/pass.
 */
async function paseDeCuenta(sub: string) {
  const token = await pasePorCuenta(sub);
  const secret = process.env.PASS_SECRET;
  if (!token || !secret) return null;
  const r = await verifyPass(token, secret);
  if (!r.ok) return null;
  return {
    token,
    email: r.claims.email,
    expiresAt: r.claims.expiresAt,
    plan: r.claims.plan,
  };
}

function datosSesion(s: Sesion) {
  return { sub: s.sub, email: s.email, nombre: s.nombre, foto: s.foto };
}

// ---------- quién soy ----------

export async function GET(req: Request) {
  const sesion = await sesionDeRequest(req);
  if (!sesion) {
    // Sin sesión la respuesta igual sirve de diagnóstico: si el login no
    // aparece en la app, acá se ve si es porque falta configurarlo o porque
    // simplemente no entró nadie todavía.
    return Response.json(
      {
        sesion: null,
        loginConfigurado: Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
        pasesEntreDispositivos: kv.disponible(),
        ayuda: !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
          ? "Falta NEXT_PUBLIC_GOOGLE_CLIENT_ID en este deploy. Cargalo en Vercel y REDEPLOYÁ."
          : kv.motivoNoDisponible() || undefined,
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "desconocido",
      },
      { headers: SIN_CACHE }
    );
  }
  return Response.json(
    { sesion: datosSesion(sesion), pase: await paseDeCuenta(sesion.sub) },
    { headers: SIN_CACHE }
  );
}

// ---------- entrar ----------

export async function POST(req: Request) {
  if (!sameOriginStrict(req)) {
    return Response.json({ ok: false, error: "Origen no permitido." }, { status: 403, headers: SIN_CACHE });
  }
  const rl = rateLimit(req, "auth", 20, 60_000);
  if (!rl.ok) {
    return Response.json(
      { ok: false, error: "Demasiados intentos. Esperá un momento." },
      { status: 429, headers: { ...SIN_CACHE, "Retry-After": String(rl.retryAfter) } }
    );
  }

  let credential = "";
  try {
    const body = await req.json();
    credential = String(body?.credential || "");
  } catch {
    return Response.json({ ok: false, error: "Body inválido." }, { status: 400, headers: SIN_CACHE });
  }
  // Un ID token de Google ronda los 1000 caracteres; 4000 es techo de sobra y
  // corta que nos manden un megabyte para hacernos trabajar de gusto.
  if (!credential || credential.length > 4000) {
    return Response.json({ ok: false, error: "Falta el token de Google." }, { status: 400, headers: SIN_CACHE });
  }

  const v = await verificarIdToken(credential);
  if (!v.ok) {
    console.error("[auth] login rechazado:", v.motivo);
    return Response.json({ ok: false, error: v.motivo }, { status: 401, headers: SIN_CACHE });
  }

  const token = await crearSesion({
    sub: v.user.sub,
    email: v.user.email,
    nombre: v.user.nombre,
    foto: v.user.foto,
  });
  if (!token) {
    return Response.json(
      {
        ok: false,
        error:
          "Las sesiones no están configuradas en el servidor (falta PASS_SECRET). Es un problema del deploy, no tuyo.",
      },
      { status: 500, headers: SIN_CACHE }
    );
  }

  return Response.json(
    {
      ok: true,
      sesion: { sub: v.user.sub, email: v.user.email, nombre: v.user.nombre, foto: v.user.foto },
      pase: await paseDeCuenta(v.user.sub),
    },
    { headers: { ...SIN_CACHE, "Set-Cookie": cookieDeSesion(token) } }
  );
}

// ---------- salir ----------

export async function DELETE(req: Request) {
  if (!sameOriginStrict(req)) {
    return Response.json({ ok: false, error: "Origen no permitido." }, { status: 403, headers: SIN_CACHE });
  }
  return Response.json({ ok: true }, { headers: { ...SIN_CACHE, "Set-Cookie": cookieBorrada() } });
}

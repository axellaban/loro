// La sesión: quién está adentro, en una cookie firmada.
//
// El ID token de Google vence en una hora, así que no sirve como sesión: la
// persona tendría que volver a entrar mientras usa la app. Lo que hacemos es
// verificarlo UNA vez (lib/google.ts) y a partir de ahí emitir lo nuestro,
// firmado con el mismo mecanismo HMAC que los pases.
//
// Va en una cookie HttpOnly, no en el localStorage, por una razón concreta: el
// JavaScript de la página no puede leerla, así que un script inyectado no se
// la puede llevar. Y viaja sola en cada pedido, que es justo lo que necesita
// /api/pass para saber quién está canjeando.

import { b64urlDecode, b64urlEncode, hmac, timingSafeEqual } from "./pass";

export const SESSION_COOKIE = "loreado_sesion";

/** 30 días. Se renueva sola en cada visita, así que en la práctica no vence. */
const DIAS = 30;
const MAX_AGE = DIAS * 24 * 60 * 60;

export type Sesion = {
  sub: string;
  email: string;
  nombre: string;
  foto: string;
  /** Epoch ms del vencimiento de la sesión. */
  expiresAt: number;
};

/**
 * El secreto de las sesiones. Si no hay uno propio se usa el de los pases: son
 * dominios distintos pero el prefijo de abajo hace que un token de uno nunca
 * pueda hacerse pasar por el del otro, y así no hay que cargar otra variable
 * en Vercel para que esto funcione.
 */
function secreto(): string | null {
  return process.env.SESSION_SECRET || process.env.PASS_SECRET || null;
}

/** Separa el dominio: una firma de sesión no vale como firma de pase. */
const PREFIX = "SES1";

export async function crearSesion(
  datos: Omit<Sesion, "expiresAt">,
  ahora: number = Date.now()
): Promise<string | null> {
  const s = secreto();
  if (!s) return null;
  const sesion: Sesion = { ...datos, expiresAt: ahora + MAX_AGE * 1000 };
  const payload = b64urlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        s: sesion.sub,
        e: sesion.email,
        n: sesion.nombre,
        f: sesion.foto,
        x: sesion.expiresAt,
      })
    )
  );
  return `${PREFIX}.${payload}.${await hmac(`${PREFIX}.${payload}`, s)}`;
}

export async function leerSesion(
  token: string,
  ahora: number = Date.now()
): Promise<Sesion | null> {
  const s = secreto();
  if (!s || !token) return null;
  const partes = String(token).split(".");
  if (partes.length !== 3 || partes[0] !== PREFIX) return null;

  let esperada: string;
  try {
    esperada = await hmac(`${partes[0]}.${partes[1]}`, s);
  } catch {
    return null;
  }
  if (!timingSafeEqual(partes[2], esperada)) return null;

  try {
    const raw: any = JSON.parse(new TextDecoder().decode(b64urlDecode(partes[1])));
    const sesion: Sesion = {
      sub: String(raw?.s || ""),
      email: String(raw?.e || ""),
      nombre: String(raw?.n || ""),
      foto: String(raw?.f || ""),
      expiresAt: Number(raw?.x || 0),
    };
    if (!sesion.sub || !sesion.email) return null;
    if (ahora > sesion.expiresAt) return null;
    return sesion;
  } catch {
    return null;
  }
}

/** La sesión que trae un pedido, o null si no hay o no vale. */
export async function sesionDeRequest(req: Request): Promise<Sesion | null> {
  const cookie = req.headers.get("cookie") || "";
  for (const parte of cookie.split(";")) {
    const [k, ...resto] = parte.trim().split("=");
    if (k === SESSION_COOKIE) return leerSesion(decodeURIComponent(resto.join("=")));
  }
  return null;
}

export function cookieDeSesion(token: string): string {
  // SameSite=Lax: la cookie viaja en la navegación normal pero no en pedidos
  // que dispare otro sitio, que es la defensa contra CSRF. Secure siempre —
  // en localhost el navegador lo tolera sobre http.
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export function cookieBorrada(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

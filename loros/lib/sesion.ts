// Quién sos, sin registrarte.
//
// No hay login: la primera vez que alguien entra se le crea un nido y se le
// deja una cookie firmada con su id. Es todo lo que hace falta para que la app
// sepa de quién es cada loro, y evita la única pantalla que mataría a un MVP
// como este —"creá una cuenta"— antes de que la persona vea el mapa.
//
// La firma HMAC no es decorativa: sin ella, la cookie es un campo de texto que
// cualquiera edita para leer el buzón de otro. Con ella, para hacerse pasar por
// otro nido hay que falsificar la firma, y para eso hace falta el secreto.
//
// HttpOnly: el JavaScript de la página no la puede leer, así que un script
// inyectado no se la puede llevar.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const COOKIE = "loro_nido";
const DIAS = 365;
const MAX_AGE = DIAS * 24 * 60 * 60;

/**
 * En desarrollo hay un secreto fijo para que clonar el repo y correrlo no pida
 * configurar nada. En producción eso sería un agujero —cualquiera que lea el
 * código firma la cookie que quiera—, así que ahí se exige LOROS_SECRET.
 */
const SECRETO_DEV = "loros-dev-no-usar-en-produccion";

function secreto(): string {
  const s = process.env.LOROS_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[sesion] Falta LOROS_SECRET en producción: las cookies se firman con el secreto de desarrollo, que es público. Generá uno con `openssl rand -base64 32`."
    );
  }
  return SECRETO_DEV;
}

function firmar(id: string): string {
  return createHmac("sha256", secreto()).update(id).digest("base64url");
}

function firmasIguales(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function nuevoId(): string {
  return randomBytes(12).toString("base64url");
}

export function tokenDe(id: string): string {
  return `${id}.${firmar(id)}`;
}

/** El id que hay adentro de un token, si la firma cierra. */
export function idDeToken(token: string): string | null {
  const corte = String(token || "").lastIndexOf(".");
  if (corte <= 0) return null;
  const id = token.slice(0, corte);
  return firmasIguales(token.slice(corte + 1), firmar(id)) ? id : null;
}

/** El id del nido que trae el pedido, o null si no hay cookie o está adulterada. */
export function idDeRequest(req: Request): string | null {
  const cookies = req.headers.get("cookie") || "";
  for (const parte of cookies.split(";")) {
    const [k, ...resto] = parte.trim().split("=");
    if (k !== COOKIE) continue;
    return idDeToken(decodeURIComponent(resto.join("=")));
  }
  return null;
}

export function cookieDeSesion(id: string): string {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${COOKIE}=${encodeURIComponent(tokenDe(id))}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export function cookieBorrada(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

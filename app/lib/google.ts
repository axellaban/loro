// Verificación del ID token que devuelve Google Identity Services.
//
// El navegador recibe de Google un JWT firmado y nos lo manda. Verificarlo del
// lado del servidor no es opcional: sin eso, cualquiera puede mandar un JSON
// con el email que se le antoje y quedarse con el pase de otro. Todo lo que
// sigue existe para responder una sola pregunta —¿Google firmó esto, para
// NUESTRA app, y todavía vale?— y no hay atajo que la conteste.
//
// Se hace con Web Crypto (RS256) contra las claves públicas de Google, así que
// no hace falta ninguna librería de JWT y corre en el runtime edge igual que
// el resto. El Client Secret de Google no se usa nunca: este flujo no lo
// necesita, y un secreto que no existe no se puede filtrar.

import { b64urlDecode } from "./pass";

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export type GoogleUser = {
  /** Identificador estable de la cuenta. Es la clave real: el email puede cambiar. */
  sub: string;
  email: string;
  nombre: string;
  foto: string;
};

export type GoogleResult =
  | { ok: true; user: GoogleUser }
  | { ok: false; motivo: string };

/**
 * Caché de las claves públicas de Google.
 *
 * Google las rota, así que no se pueden fijar en el código, pero traerlas en
 * cada login sumaría un viaje de red al camino más sensible de la app. Se
 * respeta el `max-age` que manda Google y se refresca sola.
 */
let jwks: { claves: Map<string, JsonWebKey>; hasta: number } | null = null;

async function clavePublica(kid: string): Promise<JsonWebKey | null> {
  const ahora = Date.now();
  if (jwks && ahora < jwks.hasta) {
    const k = jwks.claves.get(kid);
    if (k) return k;
    // El `kid` no está en la caché: Google rotó antes de que venciera. Se
    // fuerza un refresco en vez de rechazar un login legítimo.
  }

  const r = await fetch(JWKS_URL, { cache: "no-store" });
  if (!r.ok) throw new Error(`JWKS de Google devolvió ${r.status}`);
  const j: any = await r.json();
  const claves = new Map<string, JsonWebKey>();
  for (const k of j?.keys || []) {
    if (k?.kid) claves.set(k.kid, k);
  }

  // Se respeta el max-age de Google; si no viene, una hora.
  const cc = r.headers.get("cache-control") || "";
  const m = /max-age=(\d+)/.exec(cc);
  const ttl = m ? Number(m[1]) * 1000 : 3600_000;
  jwks = { claves, hasta: ahora + Math.max(60_000, ttl) };

  return claves.get(kid) || null;
}

/**
 * Verifica el token y devuelve quién es. Cuando falla dice por qué: los
 * motivos se resuelven de maneras muy distintas (falta una variable, el
 * origen no está autorizado, el reloj del server está corrido) y desde afuera
 * se ven todos igual.
 */
export async function verificarIdToken(idToken: string): Promise<GoogleResult> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return {
      ok: false,
      motivo:
        "Falta NEXT_PUBLIC_GOOGLE_CLIENT_ID en este deploy. Cargalo en Vercel y REDEPLOYÁ: las variables nuevas no entran en un deploy ya hecho.",
    };
  }

  const partes = String(idToken || "").split(".");
  if (partes.length !== 3) return { ok: false, motivo: "El token de Google está mal formado." };

  let header: any;
  let payload: any;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(partes[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(partes[1])));
  } catch {
    return { ok: false, motivo: "No se pudo leer el token de Google." };
  }

  // Solo RS256. Aceptar el algoritmo que declare el token es el agujero
  // clásico de los JWT: con "alg": "none" entra cualquiera.
  if (header?.alg !== "RS256") {
    return { ok: false, motivo: "El token de Google no viene firmado con RS256." };
  }
  if (!header?.kid) return { ok: false, motivo: "El token de Google no dice con qué clave se firmó." };

  let jwk: JsonWebKey | null;
  try {
    jwk = await clavePublica(header.kid);
  } catch (err: any) {
    return { ok: false, motivo: `No se pudo llegar a las claves de Google: ${err?.message || "error desconocido"}` };
  }
  if (!jwk) return { ok: false, motivo: "Google firmó el token con una clave que no reconocemos." };

  let firmaOk = false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    // Se copia a un ArrayBuffer propio: `crypto.subtle.verify` pide un buffer
    // que no sea compartido, y el que devuelve el decodificador no lo declara.
    const firma = b64urlDecode(partes[2]);
    const buf = new ArrayBuffer(firma.length);
    new Uint8Array(buf).set(firma);
    firmaOk = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      buf,
      new TextEncoder().encode(`${partes[0]}.${partes[1]}`)
    );
  } catch {
    firmaOk = false;
  }
  if (!firmaOk) return { ok: false, motivo: "La firma del token de Google no cierra." };

  // La firma cerró: el contenido es de Google. Falta que sea PARA NOSOTROS y
  // que esté vigente — un token válido emitido para otra app no sirve acá.
  if (!ISSUERS.includes(String(payload?.iss))) {
    return { ok: false, motivo: "El token no lo emitió Google." };
  }
  if (payload?.aud !== clientId) {
    return {
      ok: false,
      motivo:
        "El token es de otra app de Google. El NEXT_PUBLIC_GOOGLE_CLIENT_ID de este deploy no es el mismo con el que se hizo el login.",
    };
  }
  const ahora = Math.floor(Date.now() / 1000);
  // 60 segundos de tolerancia por relojes desfasados entre Google y Vercel.
  if (typeof payload?.exp !== "number" || ahora > payload.exp + 60) {
    return { ok: false, motivo: "El token de Google venció. Volvé a entrar." };
  }

  const email = typeof payload?.email === "string" ? payload.email.toLowerCase() : "";
  if (!email) return { ok: false, motivo: "Google no devolvió el email de la cuenta." };
  // Un email sin verificar puede no ser de quien dice ser, y el email es
  // justamente lo que se muestra y lo que ata el pase.
  if (payload?.email_verified === false) {
    return { ok: false, motivo: "Esa cuenta de Google tiene el email sin verificar." };
  }
  const sub = typeof payload?.sub === "string" ? payload.sub : "";
  if (!sub) return { ok: false, motivo: "Google no devolvió el identificador de la cuenta." };

  return {
    ok: true,
    user: {
      sub,
      email,
      nombre: typeof payload?.name === "string" ? payload.name : email.split("@")[0],
      foto: typeof payload?.picture === "string" ? payload.picture : "",
    },
  };
}

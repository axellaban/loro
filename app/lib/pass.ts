// Pases ilimitados, firmados, sin base de datos.
//
// El problema: alguien paga por WhatsApp y hay que darle acceso sin login, sin
// cuentas y sin guardar una lista de códigos en ningún lado.
//
// La solución: el código LLEVA ADENTRO a quién pertenece y hasta cuándo vale, y
// una firma HMAC que solo se puede calcular con PASS_SECRET. El servidor no
// necesita acordarse de qué códigos emitió: recalcula la firma y, si cierra, el
// código lo generamos nosotros. Uno inventado no cierra nunca.
//
// Se usa igual desde el runtime edge (los endpoints) y desde Node (el script
// que genera los códigos), porque Web Crypto está en los dos.

/** Prefijo visible: hace obvio que es un pase de Loreado si alguien lo ve suelto. */
const PREFIX = "LORO";
/**
 * La firma se recorta a 27 caracteres base64url (~160 bits). De sobra contra
 * fuerza bruta y mantiene el código lo bastante corto para pegarlo en un chat.
 */
const SIG_LEN = 27;

export type PassPlan = "week" | "year";

export type PassClaims = {
  /** A quién se le vendió. Va adentro del código a propósito: se muestra en la app. */
  email: string;
  /** Epoch ms del vencimiento. */
  expiresAt: number;
  plan: PassPlan;
};

export type PassResult =
  | { ok: true; claims: PassClaims }
  | { ok: false; reason: "format" | "signature" | "expired"; expiredAt?: number };

/** Días de cada plan, para que el script y la UI digan lo mismo. */
export const PLAN_DAYS: Record<PassPlan, number> = { week: 7, year: 365 };

// ---------- base64url (sin Buffer, para que ande en edge) ----------

// Exportados: los usa también lib/google.ts para desarmar el JWT que devuelve
// Google, que viene en el mismo formato. Es la única implementación de
// base64url del proyecto a propósito — duplicarla es la clase de detalle que
// se arregla en un lado y se olvida en el otro.
export function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- Firma ----------

/** HMAC-SHA256 en base64url, completo. Lo usa también la cookie de sesión. */
export async function hmac(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return b64urlEncode(new Uint8Array(sig));
}

async function sign(payload: string, secret: string): Promise<string> {
  return (await hmac(payload, secret)).slice(0, SIG_LEN);
}

/**
 * Comparación de tiempo constante. Contra un atacante remoto la diferencia de
 * timing es ruido, pero cuesta cuatro líneas y saca la duda de encima.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- API ----------

/** Emite un pase. Lo usa el script de generación, nunca el navegador. */
export async function createPass(
  claims: PassClaims,
  secret: string
): Promise<string> {
  // Claves cortas: el código viaja por WhatsApp y en una URL.
  const payload = b64urlEncode(
    new TextEncoder().encode(
      JSON.stringify({ e: claims.email, x: claims.expiresAt, p: claims.plan })
    )
  );
  return `${PREFIX}.${payload}.${await sign(payload, secret)}`;
}

/**
 * Verifica un pase. Devuelve por qué falló, no solo que falló: la UI dice algo
 * distinto si el código está mal escrito que si venció.
 */
export async function verifyPass(
  token: string,
  secret: string,
  now: number = Date.now()
): Promise<PassResult> {
  const parts = String(token || "").trim().split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return { ok: false, reason: "format" };
  const [, payload, sig] = parts;

  let expected: string;
  try {
    expected = await sign(payload, secret);
  } catch {
    return { ok: false, reason: "signature" };
  }
  if (!timingSafeEqual(sig, expected)) return { ok: false, reason: "signature" };

  // La firma ya cerró, así que el payload es nuestro; igual se parsea con
  // cuidado por si un código viejo tiene otra forma.
  let raw: any;
  try {
    raw = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  } catch {
    return { ok: false, reason: "format" };
  }
  const email = typeof raw?.e === "string" ? raw.e : "";
  const expiresAt = typeof raw?.x === "number" ? raw.x : 0;
  const plan: PassPlan = raw?.p === "year" ? "year" : "week";
  if (!email || !expiresAt) return { ok: false, reason: "format" };

  if (now > expiresAt) return { ok: false, reason: "expired", expiredAt: expiresAt };
  return { ok: true, claims: { email, expiresAt, plan } };
}

/**
 * Verifica el pase que viene en un request. Devuelve null si no hay pase o no
 * vale: los endpoints tratan "sin pase" y "pase inválido" igual, como usuario
 * gratuito, en vez de cortarle el acceso.
 */
export async function passFromRequest(req: Request): Promise<PassClaims | null> {
  const token = req.headers.get(PASS_HEADER);
  const secret = process.env.PASS_SECRET;
  if (!token || !secret) return null;
  const r = await verifyPass(token, secret);
  return r.ok ? r.claims : null;
}

/** Header con el que el navegador manda el pase en cada pedido caro. */
export const PASS_HEADER = "x-loro-pass";

/** Nombre del parámetro del link de canje: /app?pase=LORO.… */
export const PASS_QUERY = "pase";

/**
 * Limpia lo que la persona pegó en el campo del pase.
 *
 * Tres cosas que pasan de verdad al copiar desde un chat en el celular:
 *  - Se pega el LINK entero en vez del código.
 *  - Tocar dos veces selecciona solo un tramo entre puntos y se come el
 *    "LORO." del principio (el caso más común, y el más frustrante porque el
 *    resto del código está perfecto).
 *  - Se cuelan espacios o saltos de línea.
 *
 * Ninguna de las tres es culpa de quien pagó, así que se corrigen acá en vez
 * de rechazar el pase. La firma sigue decidiendo: esto solo arma bien la
 * cadena antes de verificarla.
 */
export function normalizePassInput(raw: string): string {
  let s = String(raw || "").trim();
  if (!s) return "";

  // ¿Pegó el link? Sacamos el código de adentro.
  if (/^https?:\/\//i.test(s) || s.includes(`${PASS_QUERY}=`)) {
    try {
      const u = new URL(s, "https://loreado.local");
      const t = u.searchParams.get(PASS_QUERY);
      if (t) s = t;
    } catch {}
  }

  s = s.replace(/\s+/g, "");

  // Le falta el prefijo pero tiene las dos partes: se lo devolvemos.
  if (!s.startsWith(`${PREFIX}.`) && s.split(".").length === 2) s = `${PREFIX}.${s}`;
  return s;
}

/** "3 ago 2026" — cómo se muestra el vencimiento en la app. */
export function fmtPassExpiry(ts: number): string {
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const d = new Date(ts);
  return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

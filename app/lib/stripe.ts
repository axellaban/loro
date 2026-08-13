// Stripe, hablado a mano por HTTP.
//
// Mismo criterio que lib/kv.ts: la API de Stripe es form-encoded sobre HTTPS,
// así que un `fetch` alcanza. El SDK oficial suma ~2MB al bundle, arrastra
// polyfills de Node y en el runtime edge —donde corre TODO este proyecto—
// obliga a configurarle un http client aparte. Nada de eso compra nada acá:
// usamos seis endpoints y los seis son un POST con un body plano.
//
// Lo que sí importa y está resuelto acá:
//  - Idempotencia en toda escritura (Stripe reintenta; nosotros también).
//  - Verificación de firma del webhook con Web Crypto, que es la única parte
//    donde equivocarse tiene consecuencias de plata.
//
// Si las variables no están cargadas, `disponible()` da false y los endpoints
// contestan que el pago con tarjeta no está configurado, sin romper el resto
// de la app: Mercado Pago y Binance siguen funcionando como siempre.

const API = "https://api.stripe.com/v1";

/**
 * Versión de la API fijada a mano.
 *
 * Sin este header Stripe usa la versión de la cuenta, que cambia cuando se
 * toca un botón en el dashboard — y ahí un campo se renombra en producción sin
 * que nadie haya deployado nada. Fijándola, actualizar es un cambio de código
 * con su commit, que es como tiene que ser.
 */
const API_VERSION = "2024-06-20";

export function secretKey(): string | null {
  const k = process.env.STRIPE_SECRET_KEY?.trim();
  return k || null;
}

export function disponible(): boolean {
  return secretKey() !== null;
}

/**
 * Por qué no se puede cobrar con tarjeta, para los endpoints de diagnóstico.
 * Nunca devuelve la clave ni nada derivado de ella.
 */
export function motivoNoDisponible(): string {
  if (!process.env.STRIPE_SECRET_KEY) {
    return "Falta STRIPE_SECRET_KEY en este deploy. Cargala en Vercel y REDEPLOYÁ: las variables nuevas no entran en un deploy ya hecho.";
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return "Falta STRIPE_WEBHOOK_SECRET: los pagos se van a cobrar pero ningún pase se va a emitir solo.";
  }
  return "";
}

/** `true` si la clave cargada es de test. La UI lo muestra para no cobrar de mentira en producción. */
export function esModoTest(): boolean {
  return (secretKey() || "").startsWith("sk_test_");
}

// ---------- form encoding ----------

/**
 * Stripe no acepta JSON: quiere `application/x-www-form-urlencoded` con la
 * sintaxis de corchetes para lo anidado (`line_items[0][price]=price_123`).
 *
 * Los `undefined` se saltean en vez de mandarse como la cadena "undefined",
 * que es exactamente lo que pasa si uno arma el body concatenando y es un bug
 * silencioso: Stripe lo toma como un valor válido y guarda basura.
 */
function encode(obj: Record<string, any>, prefijo = "", out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const clave = prefijo ? `${prefijo}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === "object") encode(item, `${clave}[${i}]`, out);
        else out.append(`${clave}[${i}]`, String(item));
      });
    } else if (v && typeof v === "object") {
      encode(v, clave, out);
    } else {
      out.append(clave, String(v));
    }
  }
  return out;
}

export type StripeError = { tipo: "config" | "stripe" | "red"; mensaje: string; status?: number };

export type StripeResult<T> = { ok: true; data: T } | { ok: false; error: StripeError };

/**
 * Una llamada a la API de Stripe.
 *
 * `idempotencyKey` no es opcional por gusto: este código corre detrás de un
 * webhook que Stripe reintenta y de un redirect que la gente recarga. Sin la
 * clave, un reintento crea un SEGUNDO cliente o una SEGUNDA suscripción y eso
 * se cobra de verdad. Con ella, Stripe devuelve la respuesta original.
 */
export async function stripeApi<T = any>(
  path: string,
  opciones: {
    method?: "GET" | "POST";
    params?: Record<string, any>;
    idempotencyKey?: string;
  } = {}
): Promise<StripeResult<T>> {
  const key = secretKey();
  if (!key) return { ok: false, error: { tipo: "config", mensaje: motivoNoDisponible() } };

  const { method = "POST", params = {}, idempotencyKey } = opciones;
  const body = encode(params);
  const url = method === "GET" ? `${API}${path}?${body.toString()}` : `${API}${path}`;

  // Con tope: estos pedidos están en el camino de alguien que quiere pagar. Si
  // Stripe se cuelga (que es distinto de fallar), la persona se queda mirando
  // un botón que no responde.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Stripe-Version": API_VERSION,
        ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      ...(method === "POST" ? { body: body.toString() } : {}),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const j: any = await r.json().catch(() => null);
    if (!r.ok) {
      const mensaje = j?.error?.message || `Stripe devolvió ${r.status}.`;
      console.error(`[stripe] ${method} ${path} → ${r.status}: ${mensaje}`);
      return { ok: false, error: { tipo: "stripe", mensaje, status: r.status } };
    }
    return { ok: true, data: j as T };
  } catch (err: any) {
    console.error(`[stripe] ${method} ${path} falló:`, err?.message || err);
    return { ok: false, error: { tipo: "red", mensaje: "No se pudo hablar con Stripe." } };
  } finally {
    clearTimeout(t);
  }
}

// ---------- Verificación del webhook ----------

/**
 * HMAC-SHA256 en hex. Stripe firma en hex; los pases del proyecto en base64url
 * (lib/pass.ts). Es la misma primitiva con otra salida, y por eso vive acá y no
 * allá: mezclarlas invita a usar la codificación equivocada en el lugar donde
 * una firma que no cierra significa "cualquiera puede regalarse un pase".
 */
async function hmacHex(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  let out = "";
  for (let i = 0; i < sig.length; i++) out += sig[i].toString(16).padStart(2, "0");
  return out;
}

/** Comparación de tiempo constante, sobre strings del mismo largo. */
function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Ventana de tolerancia del timestamp: 5 minutos, igual que el default del SDK
 * oficial. Sin este chequeo, alguien que haya grabado un webhook válido puede
 * reproducirlo para siempre y regenerarse el pase cada vez que quiera.
 */
const TOLERANCIA_S = 5 * 60;

export type FirmaResult =
  | { ok: true; evento: any }
  | { ok: false; motivo: string };

/**
 * Verifica la firma de un webhook y devuelve el evento ya parseado.
 *
 * El `cuerpo` tiene que ser el texto CRUDO, tal como llegó. Si se parsea a
 * JSON y se vuelve a serializar, cambia el espaciado y la firma deja de cerrar
 * — es el error clásico y se manifiesta como "todos los webhooks fallan" sin
 * ninguna pista de por qué.
 */
export async function verificarFirma(
  cuerpo: string,
  header: string | null,
  secret: string | undefined,
  ahora: number = Date.now()
): Promise<FirmaResult> {
  if (!secret) return { ok: false, motivo: "Falta STRIPE_WEBHOOK_SECRET en este deploy." };
  if (!header) return { ok: false, motivo: "Sin header Stripe-Signature." };

  // Formato: "t=1234567890,v1=abc...,v1=def..." — puede venir más de una v1
  // durante una rotación de secreto, y hay que aceptar que cierre cualquiera.
  let t = "";
  const firmas: string[] = [];
  for (const parte of header.split(",")) {
    const [k, v] = parte.split("=", 2);
    if (k === "t") t = v;
    else if (k === "v1" && v) firmas.push(v);
  }
  if (!t || !firmas.length) return { ok: false, motivo: "Header Stripe-Signature mal formado." };

  const edadS = Math.abs(Math.floor(ahora / 1000) - Number(t));
  if (!Number.isFinite(edadS) || edadS > TOLERANCIA_S) {
    return { ok: false, motivo: "Webhook fuera de la ventana de tiempo (¿reenvío viejo?)." };
  }

  const esperada = await hmacHex(`${t}.${cuerpo}`, secret);
  if (!firmas.some((f) => igualSeguro(f, esperada))) {
    return { ok: false, motivo: "Firma inválida." };
  }

  try {
    return { ok: true, evento: JSON.parse(cuerpo) };
  } catch {
    return { ok: false, motivo: "El cuerpo del webhook no es JSON." };
  }
}

// ---------- Planes ----------

export type StripePlan = "week" | "year";

/**
 * Qué precio de Stripe corresponde a cada pase.
 *
 * Los IDs viven en variables de entorno y no en el código porque son distintos
 * en test y en producción: hardcodearlos garantiza que el día del switch a
 * live se cobre contra los precios de prueba, que es un error que solo se
 * descubre cuando alguien reclama que pagó y no le llegó nada.
 *
 * Los crea `scripts/stripe-setup.mjs`, que imprime estas dos líneas listas
 * para pegar.
 */
export function priceId(plan: StripePlan): string | null {
  const v =
    plan === "week"
      ? process.env.STRIPE_PRICE_WEEK
      : process.env.STRIPE_PRICE_YEAR;
  return v?.trim() || null;
}

/** Días de cada plan, para los pases emitidos por factura (que no tienen suscripción de dónde sacar la fecha). */
export const PLAN_DIAS: Record<StripePlan, number> = { week: 7, year: 365 };

/**
 * El catálogo, en un solo lugar.
 *
 * Es la fuente de verdad de la que salen las dos cosas que tienen que
 * coincidir sí o sí: los precios que `scripts/stripe-setup.mjs` crea en Stripe
 * y los montos que /api/stripe/invoice le factura a una empresa. Que estén
 * acá y no repetidos en cada lado es lo que evita el bug caro de siempre —
 * subir el precio en la web y seguir facturando el viejo.
 *
 * En centavos y en dólares porque así los quiere la API de Stripe, y porque
 * los pases se cobran en USD aunque el público sea latinoamericano: es la
 * moneda en la que ya están puestos los precios en la app.
 */
export const MONEDA = "usd";

export const CATALOGO: Record<StripePlan, { titulo: string; centavos: number; intervalo: "week" | "year" }> = {
  week: { titulo: "Pase Rey Loro Ilimitado (7 días)", centavos: 1999, intervalo: "week" },
  year: { titulo: "Pase Rey Loro Ilimitado (12 meses)", centavos: 8900, intervalo: "year" },
};

export function esPlan(v: unknown): v is StripePlan {
  return v === "week" || v === "year";
}

/**
 * El origen público del sitio, para armar las URLs de vuelta de Checkout.
 *
 * Se prefiere el header del propio pedido: así un preview de Vercel vuelve al
 * preview y no a producción, que es lo que pasa si uno usa una constante. El
 * fallback cubre el webhook, donde no hay pedido del navegador.
 */
export function origenDe(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  try {
    const u = new URL(req.url);
    const host = req.headers.get("x-forwarded-host") || u.host;
    const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "");
    if (host) return `${proto}://${host}`;
  } catch {}
  return env || "https://loreado.vercel.app";
}

// Licencias de Lemon Squeezy → pases de Loreado.
//
// Lemon Squeezy genera una licencia por compra y se la manda a quien pagó (en
// el email del recibo y en el botón del modal de confirmación). Acá se valida
// esa licencia contra su License API y, si es nuestra y está vigente, se
// canjea por un pase LORO firmado igual que los que se emiten a mano.
//
// Convertirla en un pase LORO y no guardar la licencia tal cual es a propósito:
// todo lo que viene después —el header en cada pedido caro, el atado a la
// cuenta de Google, la revalidación al abrir la app— ya funciona con pases
// LORO y no se entera de dónde salió. Lemon Squeezy se consulta una sola vez,
// al canjear.
//
// La License API es pública (la credencial es la licencia misma), así que no
// hace falta ninguna API key.

import { PLAN_DAYS, type PassClaims, type PassPlan } from "./pass";

/** Tienda "IA Lab" en Lemon Squeezy. Sin este chequeo, cualquier licencia de cualquier tienda abriría la app. */
const STORE_ID = 486442;

/**
 * Qué productos de la tienda son pases de Loreado, y de qué plan. La tienda
 * vende otras cosas: una licencia de otro producto no puede abrir la app.
 * Para sumar el pase de 12 meses, agregar acá su product_id con "year".
 */
const PRODUCTOS: Record<number, PassPlan> = {
  1398443: "week", // Pase Rey Loro Ilimitado (7 días)
};

const API = "https://api.lemonsqueezy.com/v1/licenses/validate";

/** Las licencias de Lemon Squeezy son UUIDs. Un pase LORO nunca tiene esta forma. */
export function esLicenciaLemon(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/**
 * Las compras de prueba (tarjeta 4242…) generan licencias igual de válidas que
 * las reales. Mientras la tienda esté en modo test, cualquiera podría "pagar"
 * así, de modo que en producción no se aceptan. En preview y local sí, para
 * poder probar el circuito completo sin cobrarse.
 *
 * Se decide por la positiva (solo entornos conocidos de prueba) para que, si
 * falta VERCEL_ENV, el resultado sea rechazar y no abrir la puerta.
 */
function aceptaLicenciasDePrueba(): boolean {
  const env = process.env.VERCEL_ENV;
  return env === "preview" || env === "development" || process.env.NODE_ENV === "development";
}

export type Canje =
  | { ok: true; claims: PassClaims }
  | { ok: false; status: number; error: string };

/**
 * Valida una licencia y devuelve los datos del pase que le corresponde.
 *
 * El vencimiento sale de Lemon Squeezy ("License length" del producto), así
 * que es el mismo cada vez que se canjea la misma licencia: el pase LORO que
 * resulta es idéntico y el atado a la cuenta de Google lo reconoce como uno
 * solo. Si el producto quedó sin vencimiento, se cuenta desde la compra con
 * los días del plan.
 */
export async function canjearLicencia(licencia: string): Promise<Canje> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  let status = 0;
  let j: any = null;
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ license_key: licencia }).toString(),
      signal: ctrl.signal,
      cache: "no-store",
    });
    status = r.status;
    j = await r.json().catch(() => null);
  } catch {
    // Red caída o Lemon Squeezy lento. No es culpa de quien pagó: que pueda
    // reintentar, y que el mensaje no diga que su código está mal.
    return {
      ok: false,
      status: 502,
      error: "No pudimos validar tu licencia ahora. Probá de nuevo en un rato.",
    };
  } finally {
    clearTimeout(t);
  }

  if (!j || status >= 500 || status === 429) {
    return {
      ok: false,
      status: 502,
      error: "No pudimos validar tu licencia ahora. Probá de nuevo en un rato.",
    };
  }

  const lic = j.license_key || {};
  const meta = j.meta || {};
  if (!meta.store_id) {
    return { ok: false, status: 400, error: "Esa licencia no es válida. Revisá que la hayas copiado entera." };
  }

  // Primero de quién es: una licencia ajena no merece ningún otro mensaje.
  const plan = PRODUCTOS[Number(meta.product_id)];
  if (Number(meta.store_id) !== STORE_ID || !plan) {
    return { ok: false, status: 400, error: "Esa licencia no es de un pase de Loreado." };
  }
  if (lic.test_mode && !aceptaLicenciasDePrueba()) {
    return { ok: false, status: 400, error: "Esa licencia es de una compra de prueba." };
  }
  if (lic.status === "disabled") {
    return {
      ok: false,
      status: 400,
      error: "Esa licencia está desactivada. Si creés que es un error, escribime.",
    };
  }

  const creada = Date.parse(lic.created_at || "");
  const vence = lic.expires_at
    ? Date.parse(lic.expires_at)
    : Number.isFinite(creada)
      ? creada + PLAN_DAYS[plan] * 24 * 60 * 60 * 1000
      : NaN;
  if (!Number.isFinite(vence)) {
    return { ok: false, status: 502, error: "No pudimos leer el vencimiento de tu licencia. Escribime." };
  }
  if (lic.status === "expired" || vence <= Date.now()) {
    return { ok: false, status: 400, error: "Tu pase ya venció. Podés comprar otro cuando quieras." };
  }
  // Cualquier otro rechazo que Lemon Squeezy explique y no hayamos cubierto.
  if (!j.valid) {
    return { ok: false, status: 400, error: "Esa licencia no es válida." };
  }

  const email = String(meta.customer_email || "").trim();
  if (!email) {
    return { ok: false, status: 502, error: "No pudimos leer los datos de tu compra. Escribime." };
  }

  return { ok: true, claims: { email, expiresAt: vence, plan } };
}

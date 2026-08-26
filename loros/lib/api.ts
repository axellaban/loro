// Lo que comparten todas las rutas: respuestas sin caché, freno por IP y el
// guard de mismo origen.

import { idDeRequest } from "./sesion";
import { nido, type Nido } from "./datos";

const SIN_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Content-Type": "application/json; charset=utf-8",
} as const;

export function ok(datos: unknown, extra?: HeadersInit): Response {
  return new Response(JSON.stringify(datos), {
    headers: { ...SIN_CACHE, ...(extra as any) },
  });
}

export function error(mensaje: string, status = 400, extra?: HeadersInit): Response {
  return new Response(JSON.stringify({ ok: false, error: mensaje }), {
    status,
    headers: { ...SIN_CACHE, ...(extra as any) },
  });
}

/**
 * Rate limit en memoria del proceso. Honesto sobre lo que es: frena el abuso
 * trivial desde una IP, no un ataque distribuido, y se resetea en cada cold
 * start. Para un MVP alcanza; para producción de verdad va contra Redis.
 */
const cubos = new Map<string, { n: number; hasta: number }>();

export function freno(
  req: Request,
  clave: string,
  limite: number,
  ventanaMs: number
): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const id = `${clave}:${ip}`;
  const ahora = Date.now();

  if (cubos.size > 5000) {
    cubos.forEach((b, k) => {
      if (ahora > b.hasta) cubos.delete(k);
    });
  }

  const b = cubos.get(id);
  if (!b || ahora > b.hasta) {
    cubos.set(id, { n: 1, hasta: ahora + ventanaMs });
    return true;
  }
  b.n += 1;
  return b.n <= limite;
}

/**
 * Que el pedido haya nacido en esta misma app. Sec-Fetch-Site sirve tanto como
 * Origin y encima el JavaScript de la página no lo puede escribir; se aceptan
 * los dos porque hay navegadores que omiten Origin en POST del mismo origen.
 */
export function mismoOrigen(req: Request): boolean {
  const host = req.headers.get("host");
  if (!host) return false;
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const site = req.headers.get("sec-fetch-site");
  return site === "same-origin" || site === "same-site" || site === "none";
}

/** El nido de quien hace el pedido, o null si no tiene cookie válida. */
export async function nidoDeRequest(req: Request): Promise<Nido | null> {
  const id = idDeRequest(req);
  return id ? nido(id) : null;
}

export async function cuerpo(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

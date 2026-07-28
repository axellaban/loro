// Rate-limit por IP, en memoria (sin dependencias ni infra externa).
//
// Limitaciones honestas: el store vive en el módulo, así que es por-isolate y
// se resetea en cold start; no se comparte entre regiones/instancias de Vercel.
// Frena el abuso trivial (un for-loop desde una IP que cae en el mismo isolate
// caliente), NO un ataque distribuido. Para protección real hace falta un store
// compartido (Upstash/Vercel KV) + auth. Suficiente para la fase de guerrilla.

type Bucket = { count: number; reset: number };
const store = new Map<string, Bucket>();

// Poda oportunista para que el Map no crezca sin límite.
function prune(now: number) {
  if (store.size < 5000) return;
  store.forEach((b, k) => {
    if (now > b.reset) store.delete(k);
  });
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export function rateLimit(
  req: Request,
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  prune(now);
  const id = `${key}:${clientIp(req)}`;
  const b = store.get(id);
  if (!b || now > b.reset) {
    store.set(id, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((b.reset - now) / 1000) };
  }
  return { ok: true, remaining: limit - b.count, retryAfter: 0 };
}

// Kill switch global de los endpoints pagos (Deepgram + LLM). Con
// CAPACITY_CLOSED=1 en Vercel (+ redeploy), /api/answer y /api/deepgram-token
// devuelven 503 y la UI muestra "cupos agotados + lista de espera". Es el
// freno de mano para un pico viral que se va de presupuesto: se corta el
// gasto en ~1 minuto sin tocar código. /api/waitlist queda siempre abierto.
export function capacityClosed(): boolean {
  return process.env.CAPACITY_CLOSED === "1";
}

// Guard de mismo-origen: acepta el pedido si Origin coincide con el host, o si
// no hay Origin pero el navegador declara que el pedido es same-site.
//
// Por qué el segundo camino: NO todos los navegadores mandan Origin en un POST
// del mismo origen. Safari en particular lo omite en varios casos, y con la
// versión anterior de este guard —que exigía Origin sí o sí— la app entera
// devolvía 403 en esos navegadores: no se podía dejar el email, ni activar un
// pase, ni pedir una respuesta.
//
// Sec-Fetch-Site es tan confiable como Origin para esto: los navegadores lo
// mandan siempre y el JavaScript de la página NO puede escribirlo (es un
// header prohibido). Un script fuera del navegador puede falsificar cualquiera
// de los dos, así que esto NO es protección fuerte por sí solo (para eso:
// auth) — se combina con el rate-limit de arriba.
export function sameOriginStrict(req: Request): boolean {
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

  // Sin Origin: vale si el navegador dice que el pedido nació en este mismo
  // sitio. "none" (la persona escribió la URL) también es legítimo.
  const site = req.headers.get("sec-fetch-site");
  return site === "same-origin" || site === "same-site" || site === "none";
}

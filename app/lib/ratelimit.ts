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

// Guard de mismo-origen estricto: exige Origin y que su host coincida con el
// del request. Un navegador SIEMPRE manda Origin en un fetch POST (mismo o
// cross origin), así que la app real pasa; curl/scripts nativos que omiten
// Origin quedan bloqueados. Un atacante puede spoofear el header, por eso esto
// NO es protección fuerte por sí solo (para eso: auth) — se combina con el
// rate-limit de arriba.
export function sameOriginStrict(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const runtime = "edge";

/**
 * Pageviews históricas del sitio, para el contador del home.
 *
 * El número que se muestra abajo de las pastillas dejó de ser inventado: sale
 * de PostHog, que es donde ya se capturan los pageviews (`capture_pageview` en
 * AnalyticsClient). Vercel Web Analytics no sirve para esto — en Hobby no
 * expone ninguna API de lectura.
 *
 * Requiere dos variables de entorno en Vercel:
 *   POSTHOG_API_KEY     personal API key con permiso de lectura (NO la pública)
 *   POSTHOG_PROJECT_ID  el id numérico del proyecto
 * Sin ellas el endpoint responde `disponible:false` y el home cae al contador
 * cosmético de siempre: nunca rompe la portada por un problema de analytics.
 */

const HOST = process.env.POSTHOG_HOST || "https://us.posthog.com";

/**
 * Caché en memoria del isolate. PostHog cobra por consulta y el home lo pide
 * en cada visita: sin esto, una pico de tráfico se traduce en un pico de
 * consultas. Se complementa con el `s-maxage` del CDN de abajo.
 */
let cache: { total: number; hasta: number } | null = null;
const TTL_MS = 5 * 60_000;

async function pageviewsTotales(): Promise<number | null> {
  const apiKey = process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!apiKey || !projectId) return null;

  const r = await fetch(`${HOST}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: {
        kind: "HogQLQuery",
        query: "select count() from events where event = '$pageview'",
      },
    }),
  });
  if (!r.ok) {
    console.error(`[stats] PostHog devolvió ${r.status}: ${(await r.text().catch(() => "")).slice(0, 300)}`);
    return null;
  }
  const json: any = await r.json();
  const n = Number(json?.results?.[0]?.[0]);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  const ahora = Date.now();
  if (cache && ahora < cache.hasta) {
    return respuesta(cache.total, true);
  }
  let total: number | null = null;
  try {
    total = await pageviewsTotales();
  } catch (err: any) {
    console.error("[stats] excepción consultando PostHog:", err?.message || err);
  }
  if (total === null) {
    // Si ya había un valor cacheado se prefiere ese, aunque esté vencido: un
    // número viejo es mejor que hacer saltar el contador para atrás.
    if (cache) return respuesta(cache.total, true);
    return Response.json(
      { disponible: false },
      { headers: { "Cache-Control": "public, s-maxage=60" } }
    );
  }
  cache = { total, hasta: ahora + TTL_MS };
  return respuesta(total, true);
}

function respuesta(pageviews: number, disponible: boolean) {
  return Response.json(
    { disponible, pageviews },
    {
      // El CDN de Vercel sirve la misma respuesta 5 minutos y refresca en
      // segundo plano: el visitante nunca espera la consulta a PostHog.
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
    }
  );
}

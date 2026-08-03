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
 *
 * Cuando NO hay dato, la respuesta dice POR QUÉ (`motivo`). Es el mismo criterio
 * que el GET de /api/pass: sin eso, "falta la variable en Vercel", "la key no
 * tiene permiso" y "el proyecto es otro" se ven todos igual —un contador que no
 * se mueve— y no hay forma de saber cuál es desde afuera. Nunca devuelve la
 * key ni nada derivado de ella.
 */

const HOST = process.env.POSTHOG_HOST || "https://us.posthog.com";

/**
 * Caché en memoria del isolate. PostHog cobra por consulta y el home lo pide
 * en cada visita: sin esto, un pico de tráfico se traduce en un pico de
 * consultas. Se complementa con el `s-maxage` del CDN de abajo.
 */
let cache: { total: number; hasta: number } | null = null;
const TTL_MS = 5 * 60_000;

type Consulta = { total: number } | { motivo: string };

async function pageviewsTotales(): Promise<Consulta> {
  const apiKey = process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!apiKey && !projectId) {
    return { motivo: "Faltan POSTHOG_API_KEY y POSTHOG_PROJECT_ID en este deploy. Cargalas en Vercel y REDEPLOYÁ: las variables nuevas no entran en un deploy ya hecho." };
  }
  if (!apiKey) return { motivo: "Falta POSTHOG_API_KEY en este deploy (la personal API key, no la pública)." };
  if (!projectId) return { motivo: "Falta POSTHOG_PROJECT_ID en este deploy." };

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
    const detalle = (await r.text().catch(() => "")).slice(0, 300);
    console.error(`[stats] PostHog devolvió ${r.status}: ${detalle}`);
    // Los tres errores que de verdad pasan, traducidos a qué hacer.
    if (r.status === 401) {
      return { motivo: "PostHog rechazó la key (401). Revisá que sea una personal API key válida y que no se haya colado un espacio al pegarla." };
    }
    if (r.status === 403) {
      return { motivo: "PostHog aceptó la key pero no la deja leer este proyecto (403). A la personal API key le falta el scope de lectura de query/insights." };
    }
    if (r.status === 404) {
      return { motivo: `PostHog no encuentra el proyecto ${projectId} (404). Revisá el POSTHOG_PROJECT_ID, o que la región sea la correcta (hoy: ${HOST}).` };
    }
    return { motivo: `PostHog devolvió ${r.status}. ${detalle}` };
  }
  const json: any = await r.json();
  const n = Number(json?.results?.[0]?.[0]);
  if (!Number.isFinite(n)) {
    return { motivo: "PostHog respondió OK pero sin un número: la consulta devolvió algo inesperado." };
  }
  return { total: n };
}

export async function GET() {
  const ahora = Date.now();
  if (cache && ahora < cache.hasta) return respuesta(cache.total);

  let res: Consulta;
  try {
    res = await pageviewsTotales();
  } catch (err: any) {
    console.error("[stats] excepción consultando PostHog:", err?.message || err);
    res = { motivo: `No se pudo llegar a PostHog: ${err?.message || "error desconocido"}` };
  }

  if ("motivo" in res) {
    // Si ya había un valor cacheado se prefiere ese, aunque esté vencido: un
    // número viejo es mejor que hacer saltar el contador para atrás.
    if (cache) return respuesta(cache.total);
    return Response.json(
      {
        disponible: false,
        motivo: res.motivo,
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "desconocido",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  cache = { total: res.total, hasta: ahora + TTL_MS };
  return respuesta(res.total);
}

function respuesta(pageviews: number) {
  return Response.json(
    { disponible: true, pageviews },
    {
      // El CDN de Vercel sirve la misma respuesta 5 minutos y refresca en
      // segundo plano: el visitante nunca espera la consulta a PostHog.
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
    }
  );
}

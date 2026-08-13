// Eventos desde el SERVIDOR a PostHog.
//
// `app/lib/track.ts` es el wrapper del navegador (posthog-js) y no sirve acá:
// el consumo de los modelos solo se conoce del lado del servidor, dentro de un
// route de edge, donde no hay ningún SDK cargado. Esto es un `fetch` contra el
// endpoint de captura, que es todo lo que hace falta.
//
// Usa la key PÚBLICA (`NEXT_PUBLIC_POSTHOG_KEY`, la misma del navegador): es la
// de ingesta, sirve para escribir eventos y no da acceso a leer nada. Sin ella
// esto es un no-op y la medición igual queda en los logs de Vercel.
//
// Nunca tira: un problema de analytics no puede romper una respuesta que el
// usuario está esperando.

const HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/+$/, "");

/** Eventos de servidor. Separados del funnel del navegador a propósito. */
export type EventoServidor = "uso_llm" | "uso_tts";

export async function eventoServidor(
  event: EventoServidor,
  props: Record<string, string | number | boolean | null>,
  distinctId?: string
): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;

  // Con tope: esto corre mientras el stream se está cerrando. Si PostHog se
  // cuelga, la conexión del usuario no puede quedar colgada con él.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2000);
  try {
    await fetch(`${HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        // Sin persona identificada, todo el consumo del servidor cae bajo una
        // misma persona técnica. Cuando hay pase, se usa el email para poder
        // mirar el gasto por cliente.
        distinct_id: distinctId || "servidor",
        properties: {
          ...props,
          // Marca al evento como de servidor: en PostHog conviven con los del
          // navegador y no hay otra forma de distinguirlos en una consulta.
          $lib: "loro-server",
          commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "desconocido",
        },
        timestamp: new Date().toISOString(),
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });
  } catch (err: any) {
    console.error("[track-server] no se pudo registrar el evento:", err?.message || err);
  } finally {
    clearTimeout(t);
  }
}

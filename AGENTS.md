# AGENTS.md

Contexto para agentes de IA (Claude Code, Cursor, etc.) que trabajen en este repo.

## Qué es esto

**Loreado.IA** ("El Loro" 🦜) — copiloto de entrevistas laborales en tiempo real. Escucha
la entrevista por mic o audio de pestaña (Meet/Zoom), transcribe en vivo con Deepgram y,
al tocar "Responder", genera una respuesta con un LLM ancladas al CV/empresa/puesto que
cargó el usuario. Producto en español, sin login, sin fricción — pensado para viralizar
por WhatsApp.

Deploy: Next.js 14 (App Router) en Vercel. Proyecto de Vercel: `copiloto-mvp`. URL de
producción: `https://loreado.vercel.app`.

## Cómo correrlo

```bash
npm install
cp .env.example .env.local   # completar DEEPGRAM_API_KEY y GEMINI_API_KEY como mínimo
npm run dev
```

No hay `lint` ni `test` en `package.json` — no hay suite de tests ni linter configurado
en este proyecto. Para chequear tipos: `npx tsc --noEmit` (requiere `npm install` primero,
si no vas a ver ruido de módulos faltantes que no tiene que ver con tu cambio).

## Estructura

- `app/app/page.tsx` — **toda** la UI y lógica de cliente en un solo componente grande
  (estado, WebSocket a Deepgram, generación de respuestas, paywall, waitlist, share).
  Es el archivo que más se toca.
- `app/api/deepgram-token/route.ts` — emite un token temporal (grant, 60s) de Deepgram.
  La API key permanente nunca llega al browser.
- `app/api/answer/route.ts` — genera la respuesta con streaming. Soporta tres providers
  (`gemini` | `anthropic` | `openai`) aunque la UI hoy solo expone modelos Gemini.
- `app/api/waitlist/route.ts` — reenvía el email al Google Form desde el servidor
  (reporta éxito/fallo real, a diferencia de un submit `no-cors` opaco).
- `app/lib/ratelimit.ts` — rate limiting in-memory, guard de same-origin estricto, y
  `capacityClosed()` (kill switch global).
- `app/lib/track.ts` — wrapper de analytics (`track()`, `identify()`), fail-safe (nunca
  rompe la UI). Todo evento nuevo se agrega al union type `FunnelEvent` acá.
- `app/lib/uso.ts` — medición de consumo: lee los tokens que informa cada proveedor
  dentro del stream y los reporta (log `[uso]` + evento a PostHog). El costo sale de
  `app/lib/precios.ts`, que es el único lugar donde viven los precios.
- `app/lib/track-server.ts` — eventos desde el servidor (edge) a PostHog. `track.ts`
  es del navegador y no sirve para esto.
- `app/api/uso/route.ts` + `app/uso/` — el panel de consumo: gasto de los modelos
  (contador propio en Upstash, se lee al instante) y saldo de Deepgram (consultado
  a Deepgram, que es el único proveedor que lo expone por API). Detrás de `USO_TOKEN`.
- `app/lib/analytics-client.tsx` — inicializa PostHog client-side (`autocapture: false`
  a propósito — en las textareas se pega CV y no queremos rozar ese contenido).
- `next.config.mjs` — reverse proxy `/ingest/*` → PostHog (evita adblockers).

## Convenciones del código

- Comentarios en **español**, solo para el "por qué" no obvio (constraints, decisiones de
  producto, workarounds). No comentar lo que el código ya dice.
- Analytics: siempre a través de `track()`/`identify()` de `app/lib/track.ts`, nunca
  `posthog.capture` directo desde componentes. Nombrar eventos en snake_case
  (`answer_requested`, no `answerRequested`).
- Todo endpoint que le paga a un proveedor reporta su consumo con `reportarUso()` de
  `app/lib/uso.ts`. Si agregás un modelo al registro, cargale el precio en
  `app/lib/precios.ts`: sin precio los tokens se miden igual, pero el costo queda en
  blanco (`usd=sin-precio`) y ese gasto no aparece en ningún total.
- El generar respuesta es **siempre manual** (botón "Responder"), nunca automático
  mientras la persona habla — es una decisión de producto explícita, no la cambies sin
  que te lo pidan.
- Runtime `edge` en las rutas de API (`export const runtime = "edge"`) — ojo con APIs de
  Node que no existen en Edge.

## Variables de entorno

Ver `.env.example` para la lista completa y comentarios. Resumen:

| Variable | Requerida | Qué hace |
|---|---|---|
| `DEEPGRAM_API_KEY` | Sí | Transcripción streaming |
| `GEMINI_API_KEY` | Sí | Generación de respuestas (provider default) |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | No | Providers alternativos, soportados en backend, sin UI hoy |
| `GEMINI_MODEL` / `ANTHROPIC_MODEL` / `OPENAI_MODEL` | No | Override de modelo por provider |
| `CAPACITY_CLOSED` | No | `"1"` = kill switch: 503 en endpoints pagos, la waitlist sigue abierta. Requiere redeploy |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | Sin ella, `track()` es no-op hacia PostHog (Vercel Analytics igual descarta eventos custom en Hobby). El servidor usa la misma key para los eventos de consumo (`uso_llm`, `uso_tts`) |
| `USO_TOKEN` | No | Token del panel de consumo (`/uso`). Sin él, el panel responde 503 |
| `PRESUPUESTO_MENSUAL_USD` | No | Contra qué compara el panel el gasto en modelos. Los tres proveedores de LLM no exponen saldo por API: el límite lo ponés vos |
| `GFORM_ACTION` / `GFORM_EMAIL_ENTRY` | No | Override del Google Form de waitlist |

Las `NEXT_PUBLIC_*` se leen en build time — cambiarlas en Vercel requiere redeploy.

## Deploy y ramas

- `main` se deployea solo a producción en Vercel al hacer push (Git integration).
- Flujo típico: rama de trabajo → commit → PR → merge (squash) a `main` → Vercel
  redeploya solo.
- No hay CI configurado (`.github/workflows` no existe) — el único check automático en
  los PRs es el deployment de preview de Vercel.

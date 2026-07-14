# LAUNCH.md — Checklist pre-lanzamiento (guerrilla / antimarketing)

La táctica es un solo post en foros y comunidades, boca a boca puro, sin redes.
Eso significa que el tráfico —si llega— llega **de golpe y sin aviso**. Este
checklist es todo lo que hay que dejar listo ANTES de publicar el post. Nada de
esto es código: son cuentas, límites y llaves que solo puede tocar el dueño.

---

## 1. Gemini: salir del free tier (bloqueante)

El free tier de `gemini-2.5-flash` tiene límites del orden de **~10 requests
por minuto y ~250 por día**. Con eso, `/api/answer` muere con los primeros
~30 usuarios del día — justo cuando el post empieza a funcionar.

- [ ] Entrar a [aistudio.google.com](https://aistudio.google.com) → verificar si la key está en free tier.
- [ ] Activar billing (tier pago) para la key / proyecto.
- [ ] En Google Cloud Console → Billing → **Budgets & alerts**: crear un presupuesto (ej. US$50/mes) con alertas al 50/90/100%.

Referencia de costo: `gemini-2.5-flash` cuesta centavos por millón de tokens;
el LLM **no** es el gasto grande acá. El gasto grande es Deepgram.

## 2. Deepgram: crédito y límites de gasto (bloqueante)

Cada sesión de 10 minutos ≈ **US$0.06** de transcripción (Nova-2 streaming).
1.000 sesiones ≈ US$60. 10.000 usuarios usando sus 5 sesiones ≈ US$3.000.

- [ ] [console.deepgram.com](https://console.deepgram.com) → revisar el balance/crédito disponible.
- [ ] Configurar límites de uso / alertas de consumo en el proyecto (Settings → Usage).
- [ ] Decidir el techo: cuando el crédito llegue a X, activar el kill switch (punto 5).

## 3. Riesgo pendiente: el fallback de la API key de Deepgram

**Estado: aceptado conscientemente, "lo veo después".** Que quede escrito:

`app/api/deepgram-token/route.ts` intenta emitir un token temporal (grant,
TTL 60s). Si la key **no tiene permiso** de emitir grants, hace fallback y
**manda la API key permanente al navegador**. Cualquiera con DevTools la
extrae y puede quemar todo el crédito de Deepgram desde afuera de la app.

Para cerrar el agujero (recomendado ANTES del post):

1. En console.deepgram.com → **API Keys** → crear una key nueva con rol
   **Member** (o superior) — los grants requieren una key con permisos de
   emitir tokens (`auth/grant`).
2. Reemplazar `DEEPGRAM_API_KEY` en Vercel con la key nueva → Redeploy.
3. Verificar: `POST https://TU-APP/api/deepgram-token` (desde la app, no curl)
   debe devolver `{"scheme":"bearer",...}` — si devuelve `"fallback":true`,
   la key sigue sin poder emitir grants.
4. Cuando el grant funcione, borrar el bloque de fallback del route (las
   últimas líneas que devuelven `{ token: apiKey, scheme: "token", fallback: true }`).

## 4. PostHog: medir el funnel (sin esto, volás ciego)

El proyecto está en **Vercel Hobby**: los eventos custom de Vercel Analytics
(`track()`) se **descartan en silencio** — solo Pro los registra. Todo el
funnel ya se duplica a PostHog, pero necesita la key:

- [ ] Crear cuenta gratis en [posthog.com](https://posthog.com) (free tier: 1M eventos/mes, sobra).
- [ ] Copiar la **Project API key** (`phc_…`).
- [ ] Vercel → Settings → Environment Variables → `NEXT_PUBLIC_POSTHOG_KEY` = la key (Production + Preview) → Redeploy.
- [ ] Entrar a la app y verificar en PostHog → Activity que llegan `enter_app` / `session_start`.

Funnel a mirar durante el launch: `enter_app` → `session_start` →
`answer_generated` → `paywall_shown` → `share_whatsapp` / `waitlist_submit`.
Si `session_start / enter_app` es bajo, el problema es onboarding; si
`share_whatsapp` es alto, el loop viral está girando solo.

## 5. Kill switch: cómo frenar el gasto en 1 minuto

Si el gasto se dispara (o Deepgram se queda sin crédito y preferís cerrar
prolijo antes de que la app empiece a tirar errores):

1. Vercel → Settings → Environment Variables → agregar `CAPACITY_CLOSED` = `1` (Production).
2. Deployments → último deploy → **Redeploy** (los cambios de env no aplican solos).
3. Resultado: `/api/answer` y `/api/deepgram-token` devuelven 503, y quien
   toque "Soltar el Loro" ve **"🛑 CUPOS AGOTADOS POR HOY"** con el form de
   lista de espera. La waitlist sigue capturando emails.

Para reabrir: borrar la variable (o ponerla en `0`) y redeploy. El cierre
queda ON-brand con el antimarketing: escasez real, no una app rota.

## 6. Vercel Hobby: dónde mirar los límites

Suficiente para esta escala, pero conviene saber dónde está el tablero:

- [ ] Dashboard → Usage: **bandwidth** (100 GB/mes) y **edge function invocations**.
- [ ] Si el post explota de verdad y te acercás a los límites, Vercel degrada/pausa — el upgrade a Pro (US$20/mes) se puede hacer en caliente.

## 7. Prueba final de humo (5 minutos, desde el celular)

- [ ] Abrir la URL de producción desde el celular (datos móviles, no wifi de casa).
- [ ] Cargar empresa/puesto/CV de prueba → Soltar el Loro → hablar → "Responder" → llega respuesta en ~2s.
- [ ] Compartir por WhatsApp desde el paywall → el link con la OG card se ve bien.
- [ ] Verificar que los eventos aparecieron en PostHog.

---

# Borradores del post

Reglas del antimarketing: primera persona, cero landing-speak, admitir
limitaciones (eso genera más confianza que cualquier promesa), pedir feedback
en vez de vender, y UN solo link. Adaptar el tono a cada comunidad — nunca
pegar el mismo texto dos veces (los mods y los usuarios lo huelen).

## Versión A — foro/comunidad de búsqueda laboral (tono ayuda genuina)

> **Hice una herramienta gratis que te sopla las respuestas en las entrevistas (en vivo) — busco feedback**
>
> Hola gente. Hace unos meses estuve del lado feo de las entrevistas y me
> pasaba algo muy puntual: sabía las respuestas, pero en el momento me
> quedaba en blanco.
>
> Así que me hice una herramienta para mí y la termino de pulir para
> compartirla: escucha la entrevista en tiempo real (por el mic del celu o
> el audio del Meet), transcribe, y cuando el entrevistador termina la
> pregunta apretás un botón y te aparece una respuesta armada con TU CV
> — no inventa experiencia que no tenés, responde con lo tuyo.
>
> Es gratis y sin registro. No guarda nada: tu CV queda en tu navegador,
> el audio no se almacena en ningún lado. No hay empresa atrás, soy una
> persona con dos API keys y un fin de semana largo.
>
> Limitaciones honestas: es una web (no es "indetectable" ni pretende
> serlo), anda mejor en Chrome, y las sesiones gratis son limitadas porque
> las APIs las pago yo.
>
> Si están buscando laburo y la prueban en una entrevista real, me
> encantaría saber qué respondió mal: [URL]

## Versión B — comunidad tech/IA (tono builder, show don't tell)

> **Weekend build: copiloto de entrevistas en tiempo real (Deepgram + Gemini), gratis, sin login**
>
> Armé esto para un amigo que se quedaba en blanco en las entrevistas y se
> me fue de las manos, así que lo dejo abierto: transcripción streaming de
> la llamada + respuestas generadas en ~1.5s ancladas en tu CV, todo en
> español (y en inglés si la entrevista es en inglés).
>
> Stack por si a alguien le interesa: audio por AudioWorklet → WebSocket a
> Deepgram Nova-2 → Gemini Flash streameando bullets. Sin base de datos,
> sin login, el CV vive en localStorage. El costo lo banco yo, por eso hay
> cuota gratis.
>
> Lo interesante técnicamente fue la latencia: fin de pregunta → primera
> palabra en pantalla en menos de 2 segundos, porque leer una respuesta
> que llega tarde es peor que no tener nada.
>
> Probalo y rompelo, me sirve cada bug: [URL]

## FAQ defensivo — respuestas para los comentarios que van a venir

**"Esto es hacer trampa."**
> Es una herramienta de apoyo, como tener tus notas a mano. Responde SOLO
> con lo que está en tu CV real — el sistema tiene prohibido inventar
> experiencia. Si no sabés algo, te sugiere reconocerlo y puentear a lo que
> sí sabés. La entrevista sigue siendo tuya: leer un guion mal también se nota.

**"¿Qué hacen con mi CV / mis datos?"**
> Nada, literalmente. No hay base de datos ni login. El CV queda en el
> localStorage de tu navegador. El audio va en streaming a la API de
> transcripción y no se almacena. Cerrás la pestaña y no quedó nada nuestro.

**"¿Grabar al entrevistador es legal?"**
> No graba: transcribe en el momento y no almacena el audio. Igual, la
> normativa de grabación/escucha varía según el país — es responsabilidad de
> cada uno cómo la usa, como cualquier herramienta.

**"¿Cuál es el negocio? Nadie regala nada."**
> Hoy: ninguno, lo pago yo y por eso hay límite de sesiones. Si a la gente
> le sirve, más adelante habrá una versión paga con más tiempo. La gratis
> no va a desaparecer para los primeros usuarios.

**"Se cayó / no anda."**
> Probable: el cupo del día se agotó (las APIs las pago de mi bolsillo).
> Dejá tu email en la lista de espera y te aviso cuando abra la próxima tanda.

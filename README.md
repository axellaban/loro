# Copiloto en vivo — MVP tipo Parakeet

Asistente de respuestas en tiempo real para llamadas (entrevistas, discovery calls, reuniones).
Transcribe en streaming y genera respuestas sugeridas ancladas en tu perfil. Todo en español.

## Dos modos de captura

- **🎙 Micrófono** (celular o notebook): el dispositivo escucha la sala por el mic.
  Caso de uso: entrevista en la notebook con parlantes, celular apoyado al lado escuchando.
  Funciona en Chrome Android y Safari iOS.
- **🖥 Pestaña** (desktop): captura el audio directo de la pestaña del Meet/Zoom.
  Más limpio, pero solo Chrome/Edge desktop.

Mobile-first: en el celular se usa con tabs (Respuestas / Transcripción) y wake lock
para que no se apague la pantalla.

## Cómo funciona

```
Audio (mic o pestaña) ─► AudioWorklet (PCM16, resample a 16kHz)
        │
        ▼
   WebSocket directo ─► Deepgram Nova-2 español
        │                (endpointing + utterance_end + keepalive)
        ▼  (fin de frase detectado)
    /api/answer ─► Gemini (streaming) ─► bullets en pantalla
```

- La API key de Deepgram nunca llega al navegador: `/api/deepgram-token` emite token temporal.
- La key de Gemini vive solo en el servidor.

## Correr local

```bash
npm install
cp .env.example .env.local   # completá las 2 keys
npm run dev
```

http://localhost:3000 · Para probar el modo micrófono en el celular necesitás HTTPS,
así que lo más simple es probar directamente en Vercel (preview deploy).

## Deploy en Vercel

1. Subí el repo a GitHub.
2. Vercel → Add New → Project → Import el repo.
3. Framework Next.js (autodetectado). No cambies nada.
4. Cargá las variables de entorno (abajo).
5. Deploy. Abrí la URL desde el celular para el modo micrófono.

### Variables de entorno (Vercel → Settings → Environment Variables)

| Variable            | Requerida | De dónde                                       |
|---------------------|-----------|------------------------------------------------|
| `DEEPGRAM_API_KEY`  | Sí        | console.deepgram.com → API Keys                |
| `GEMINI_API_KEY`    | Sí        | aistudio.google.com → API Keys (Google Studio) |
| `GEMINI_MODEL`      | No        | default `gemini-2.5-flash`                    |

Marcá las 3 para Production, Preview y Development.

## Latencia real

- Deepgram interim: ~300ms · endpointing: 800ms de silencio · utterance_end: 1000ms
- Primer token de Gemini: ~400ms
- Total fin-de-frase → respuesta empezando: **~1.2–1.5s**

## Notas del modo micrófono

- Como el mic escucha la sala, también te escucha a vos. El `endpointing` corta por frase,
  así que en la práctica genera por cada intervención. Si querés que ignore tu voz hace falta
  diarización (Deepgram `diarize=true` + filtrar por speaker) — queda para v2.
- Usa echo cancellation + noise suppression en modo mic; los apaga en modo pestaña.

## Limitaciones (a propósito)

- Sin auth, sin base de datos, sin cobro. MVP funcional, no producto.
- El overlay NO es "indetectable": es una web normal. Deliberado.

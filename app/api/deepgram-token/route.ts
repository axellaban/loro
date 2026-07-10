export const runtime = "edge";

// Emite un token JWT de corta duración (~30s) para que el navegador
// abra un WebSocket directo contra Deepgram sin exponer la API key real.
export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Falta DEEPGRAM_API_KEY en las variables de entorno." },
      { status: 500 }
    );
  }

  const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl_seconds: 30 }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return Response.json(
      { error: "Deepgram rechazó la solicitud de token.", detail },
      { status: 502 }
    );
  }

  const data = await res.json();
  return Response.json({ token: data.access_token });
}

export const runtime = "edge";

// Retorna la API Key directamente para que el navegador abra el WebSocket contra Deepgram.
// Esto permite que funcione con cualquier rol de clave (incluido Member) sin requerir privilegios de Admin.
export async function POST() {
  const rawKey = process.env.DEEPGRAM_API_KEY;
  if (!rawKey) {
    return Response.json(
      { error: "Falta DEEPGRAM_API_KEY en las variables de entorno." },
      { status: 500 }
    );
  }
  const apiKey = rawKey.trim().replace(/^["']|["']$/g, "");

  return Response.json({ token: apiKey });
}


export const runtime = "edge";

// Retorna la API Key directamente para que el navegador abra el WebSocket contra Deepgram.
// Esto permite que funcione con cualquier rol de clave (incluido Member) sin requerir privilegios de Admin.
//
// Ojo: NO llamar a /v1/auth/grant acá. Ese endpoint exige que la key tenga
// scope Admin/Owner (falla con keys Member) y, cuando funciona, el token que
// devuelve no siempre trae permisos suficientes para abrir el WebSocket de
// streaming — rompe la conexión en silencio. Devolver la key tal cual es lo
// que funciona con cualquier tipo de key.
export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Falta DEEPGRAM_API_KEY en las variables de entorno." },
      { status: 500 }
    );
  }

  return Response.json({ token: apiKey });
}

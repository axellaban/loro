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

  // Validación previa: si la key es inválida/revocada, Deepgram nos devuelve acá
  // un 401 con detalle. El WebSocket del navegador, en cambio, JAMÁS expone el
  // motivo real de un fallo de handshake (por spec) — solo un "error" genérico
  // sin código ni mensaje. Chequear la key acá primero convierte ese error mudo
  // en uno accionable. Si esta llamada falla por una razón ajena a la key
  // (red, timeout), no bloqueamos: devolvemos la key igual y dejamos que la
  // conexión real lo intente.
  try {
    const check = await fetch("https://api.deepgram.com/v1/projects", {
      headers: { Authorization: `Token ${apiKey}` },
    });
    if (check.status === 401 || check.status === 403) {
      return Response.json(
        {
          error:
            "Deepgram rechazó la API key (401/403): es inválida, fue revocada o no tiene permisos. Revisá DEEPGRAM_API_KEY en las variables de entorno de Vercel.",
        },
        { status: 502 }
      );
    }
  } catch {
    // Falla de red al validar: seguimos con el flujo normal de todas formas.
  }

  return Response.json({ token: apiKey });
}

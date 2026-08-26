// La llave del nido: cómo entrar desde otro dispositivo sin cuenta ni contraseña.
//
// Por qué existe: sin login, la identidad es una cookie, y una cookie vive en
// un solo navegador. El día que alguien abre la app en la compu pierde su nido,
// su código y su bandada. Esto lo resuelve sin sumar un proveedor de identidad:
// la llave ES el token de sesión firmado, y quien lo tiene entra.
//
// Y ahí está el canje, que la interfaz dice con todas las letras: la llave no
// se comparte con nadie, porque **es** el nido. Un login con Google evita ese
// riesgo; también agrega una pantalla de registro antes de que la persona vea
// el mapa. Para un MVP que se pasa por WhatsApp, el canje va para este lado.
//
// Acá se entrega la llave; quien la canjea es /entrar, que la recibe por la URL
// del link y deja la cookie puesta antes de que se dibuje nada.

import { error, mismoOrigen, nidoDeRequest, ok } from "../../../lib/api";
import { tokenDe } from "../../../lib/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!mismoOrigen(req)) return error("Origen no permitido.", 403);
  const yo = await nidoDeRequest(req);
  if (!yo) return error("Todavía no tenés nido.", 401);
  // La llave sale solo por acá y no viaja en cada respuesta: es lo mismo que
  // hay en la cookie HttpOnly, y cuanto menos lugares la devuelvan, menos
  // superficie para que se la lleve un script inyectado.
  return ok({ ok: true, llave: tokenDe(yo.id) });
}

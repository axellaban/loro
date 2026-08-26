// Canjear la llave: /entrar?llave=… deja la cookie y manda al mapa.
//
// Es un redirect del servidor y no una pantalla con JavaScript por una razón
// concreta: cuando la cookie se pone antes de que se dibuje nada, la persona
// que abre el link en la compu ve su nido directamente. Haciéndolo del lado del
// navegador vería primero el onboarding —"armá tu nido"— y recién después su
// mapa, que es exactamente el susto que este link viene a evitar.

import { error, freno } from "../../lib/api";
import { nido } from "../../lib/datos";
import { cookieDeSesion, idDeToken } from "../../lib/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // A propósito SIN guard de mismo-origen: este link llega desde WhatsApp, del
  // historial o pegado a mano, y en todos esos casos el pedido no nace acá.
  // Lo que lo protege no es el origen sino la llave, que son 96 bits al azar
  // más una firma HMAC.
  if (!freno(req, "entrar", 20, 10 * 60_000)) {
    return error("Demasiados intentos. Esperá unos minutos.", 429);
  }

  const url = new URL(req.url);
  const id = idDeToken(url.searchParams.get("llave") || "");
  // Sin llave válida no se dice por qué: mandarlo al mapa deja que la app
  // cuente lo que corresponda según tenga o no cookie.
  if (!id || !(await nido(id))) {
    return Response.redirect(new URL("/nido", url), 303);
  }

  return new Response(null, {
    status: 303,
    headers: { Location: new URL("/nido", url).toString(), "Set-Cookie": cookieDeSesion(id) },
  });
}

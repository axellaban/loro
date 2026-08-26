// Abrir un loro que ya aterrizó.

import { cuerpo, error, freno, mismoOrigen, nidoDeRequest, ok } from "../../../../lib/api";
import { marcarLeido, nido } from "../../../../lib/datos";
import { verLoro } from "../../../../lib/vista";
import type { Nido } from "../../../../lib/datos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!mismoOrigen(req)) return error("Origen no permitido.", 403);
  if (!freno(req, "leer", 200, 10 * 60_000)) return error("Demasiados pedidos.", 429);

  const yo = await nidoDeRequest(req);
  if (!yo) return error("Todavía no tenés nido.", 401);

  const l = await marcarLeido(String((await cuerpo(req))?.id || ""), yo.id);
  if (!l) return error("Ese loro no es tuyo.", 404);

  const otro = await nido(l.de);
  const nidos = new Map<string, Nido>([[yo.id, yo]]);
  if (otro) nidos.set(otro.id, otro);
  return ok({ ok: true, loro: verLoro(l, yo.id, nidos, Date.now()) });
}

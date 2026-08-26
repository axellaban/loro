// Soltar un loro.

import { cuerpo, error, freno, mismoOrigen, nidoDeRequest, ok } from "../../../lib/api";
import { aveValida, enviarLoro, idsAmigos, nido } from "../../../lib/datos";
import { verLoro } from "../../../lib/vista";
import type { Nido } from "../../../lib/datos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!mismoOrigen(req)) return error("Origen no permitido.", 403);
  if (!freno(req, "enviar", 40, 10 * 60_000)) {
    return error("Se te cansaron las aves. Probá de nuevo en un rato.", 429);
  }

  const yo = await nidoDeRequest(req);
  if (!yo) return error("Todavía no tenés nido.", 401);

  const b = await cuerpo(req);
  const paraId = String(b?.para || "");

  // Solo a tu bandada: si no, el id de un nido ajeno alcanzaría para escribirle
  // a cualquiera.
  if (!(await idsAmigos(yo.id)).includes(paraId)) {
    return error("Ese nido no está en tu bandada.", 403);
  }
  const para = await nido(paraId);
  if (!para) return error("Ese nido ya no existe.", 404);

  const r = await enviarLoro({
    de: yo,
    para,
    ave: aveValida(b?.ave, yo.ave),
    texto: String(b?.texto ?? ""),
    turbo: Boolean(b?.turbo),
  });
  if (!r.ok) return error(r.error);

  const nidos = new Map<string, Nido>([
    [yo.id, yo],
    [para.id, para],
  ]);
  return ok({ ok: true, loro: verLoro(r.loro, yo.id, nidos, Date.now()) });
}

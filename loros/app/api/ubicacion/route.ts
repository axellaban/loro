// Mover el nido. El celular se mueve, y desde dónde despega el próximo loro
// tiene que moverse con él.

import { cuerpo, error, freno, mismoOrigen, nidoDeRequest, ok } from "../../../lib/api";
import { actualizarUbicacion, puntoDe } from "../../../lib/datos";
import { verNido } from "../../../lib/vista";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!mismoOrigen(req)) return error("Origen no permitido.", 403);
  if (!freno(req, "ubicacion", 120, 10 * 60_000)) return error("Demasiados pedidos.", 429);

  const yo = await nidoDeRequest(req);
  if (!yo) return error("Todavía no tenés nido.", 401);

  const punto = puntoDe(await cuerpo(req));
  if (!punto) return error("Coordenadas inválidas.");

  const n = await actualizarUbicacion(yo.id, punto);
  return ok({ ok: true, yo: n ? verNido(n, n) : null });
}

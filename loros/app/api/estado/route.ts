// La foto completa: quién sos, tu bandada y todos los loros que hay en el aire.
//
// Es el único endpoint que consulta la app mientras está abierta. El vuelo NO
// se transmite posición por posición: se manda cuándo salió cada loro y cuándo
// llega, y el navegador calcula el resto cuadro a cuadro. Por eso el ave se
// mueve suave aunque esto se consulte cada varios segundos.
//
// `ahora` viene del servidor a propósito: si el reloj del celular está corrido
// —y suele estarlo— el cliente lo compensa en vez de mostrar un ETA falso.

import { error, freno, nidoDeRequest, ok } from "../../../lib/api";
import { amigos, atenderVecina, buzon, escalaGlobal, type Nido } from "../../../lib/datos";
import { verLoro, verNido } from "../../../lib/vista";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!freno(req, "estado", 900, 5 * 60_000)) {
    return error("Estás consultando demasiado seguido.", 429);
  }

  const yo = await nidoDeRequest(req);
  if (!yo) return ok({ yo: null, ahora: Date.now(), escala: escalaGlobal(), amigos: [], loros: [] });

  // Doña Cotorra contesta acá: sin worker ni cron, cuando mirás ya está.
  await atenderVecina(yo.id);

  const bandada = await amigos(yo.id);
  const nidos = new Map<string, Nido>([[yo.id, yo]]);
  for (const a of bandada) nidos.set(a.id, a);

  const ahora = Date.now();
  const loros = (await buzon(yo.id)).map((l) => verLoro(l, yo.id, nidos, ahora));

  return ok({
    ahora,
    escala: escalaGlobal(),
    yo: verNido(yo, yo),
    codigo: yo.codigo,
    amigos: bandada.map((a) => verNido(a, yo)),
    loros,
  });
}

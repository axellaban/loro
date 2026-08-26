// Tu nido: crearlo, actualizarlo, abandonarlo.

import { cuerpo, error, freno, mismoOrigen, nidoDeRequest, ok } from "../../../lib/api";
import { cookieBorrada, cookieDeSesion } from "../../../lib/sesion";
import {
  aveValida,
  crearNido,
  guardarNido,
  nombreValido,
  puntoDe,
} from "../../../lib/datos";
import { verNido } from "../../../lib/vista";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const yo = await nidoDeRequest(req);
  return ok({ yo: yo ? verNido(yo) : null });
}

export async function POST(req: Request) {
  if (!mismoOrigen(req)) return error("Origen no permitido.", 403);
  if (!freno(req, "nido", 20, 10 * 60_000)) {
    return error("Demasiados nidos en poco tiempo. Esperá un momento.", 429);
  }

  const b = await cuerpo(req);
  const nombre = nombreValido(b?.nombre);
  if (!nombre) return error("Poné un nombre para tu nido.");

  const existente = await nidoDeRequest(req);
  const ave = aveValida(b?.ave, existente?.ave ?? "loro");

  // Ya tiene nido: es una edición de perfil, no un alta.
  if (existente) {
    const punto = puntoDe(b);
    const actualizado = {
      ...existente,
      nombre,
      ave,
      visto: Date.now(),
      ...(punto ? { lat: punto.lat, lng: punto.lng } : {}),
    };
    await guardarNido(actualizado);
    return ok({ ok: true, yo: verNido(actualizado, actualizado), codigo: existente.codigo });
  }

  const punto = puntoDe(b);
  if (!punto) {
    return error(
      "Sin ubicación no hay vuelo: la app necesita saber desde dónde despega tu loro."
    );
  }

  const creado = await crearNido({ nombre, ave, punto });
  // El código va acá y no solo en /api/estado: con esto la app entra al mapa
  // con todo lo que necesita, sin depender de una segunda consulta.
  return ok(
    { ok: true, yo: verNido(creado, creado), codigo: creado.codigo },
    { "Set-Cookie": cookieDeSesion(creado.id) }
  );
}

/** Soltar el nido: borra la cookie. Los datos quedan, pero ya no son de nadie. */
export async function DELETE(req: Request) {
  if (!mismoOrigen(req)) return error("Origen no permitido.", 403);
  return ok({ ok: true }, { "Set-Cookie": cookieBorrada() });
}

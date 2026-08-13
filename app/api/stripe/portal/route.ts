// El portal de facturación de Stripe: cancelar, cambiar la tarjeta, bajar facturas.
//
// No es un lujo. Vender una suscripción sin un lugar obvio donde darla de baja
// es, además de una forma rápida de ganarse contracargos, algo que las reglas
// de las tarjetas exigen. El portal lo resuelve entero y alojado por Stripe:
// acá solo hay que decir de quién es la cuenta.
//
// Exige haber entrado con Google, porque la pregunta que este endpoint contesta
// es "¿qué compró ESTA persona?" y la única forma honesta de saberlo es un
// email verificado por Google. Sin login, cualquiera que tipee el email de otro
// vería sus facturas.

import { rateLimit, sameOriginStrict } from "../../../lib/ratelimit";
import { sesionDeRequest } from "../../../lib/session";
import { clienteDeCuenta, guardarCliente } from "../../../lib/passStore";
import { disponible, motivoNoDisponible, origenDe, stripeApi } from "../../../lib/stripe";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const SIN_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Content-Type": "application/json; charset=utf-8",
} as const;

export async function POST(req: Request) {
  if (!sameOriginStrict(req)) {
    return Response.json({ ok: false, error: "Origen no permitido." }, { status: 403, headers: SIN_CACHE });
  }
  const rl = rateLimit(req, "stripe-portal", 10, 60_000);
  if (!rl.ok) {
    return Response.json(
      { ok: false, error: "Demasiados intentos. Esperá un momento." },
      { status: 429, headers: { ...SIN_CACHE, "Retry-After": String(rl.retryAfter) } }
    );
  }

  if (!disponible()) {
    return Response.json(
      { ok: false, error: "El pago con tarjeta no está configurado en el servidor.", ayuda: motivoNoDisponible() },
      { status: 503, headers: SIN_CACHE }
    );
  }

  const sesion = await sesionDeRequest(req);
  if (!sesion) {
    return Response.json(
      { ok: false, error: "Entrá con Google para administrar tu suscripción." },
      { status: 401, headers: SIN_CACHE }
    );
  }

  // Primero el cliente que ya teníamos anotado. Si no hay —porque el pase se
  // emitió por webhook antes de que esta cuenta existiera, o porque se perdió
  // la clave de Upstash— se busca por email, que es el dato que Stripe también
  // tiene. Encontrado, se anota para no volver a buscarlo nunca más.
  let customer = await clienteDeCuenta(sesion.sub);
  if (!customer) {
    const l = await stripeApi<{ data: Array<{ id: string }> }>("/customers", {
      method: "GET",
      params: { email: sesion.email, limit: 1 },
    });
    customer = l.ok ? l.data.data?.[0]?.id || null : null;
    if (customer) await guardarCliente(sesion.sub, customer).catch(() => {});
  }

  if (!customer) {
    return Response.json(
      { ok: false, error: "No encontramos compras hechas con esta cuenta." },
      { status: 404, headers: SIN_CACHE }
    );
  }

  const r = await stripeApi<{ url: string }>("/billing_portal/sessions", {
    params: { customer, return_url: `${origenDe(req)}/app` },
  });
  if (!r.ok) {
    return Response.json(
      {
        ok: false,
        error: "No se pudo abrir el portal de facturación.",
        // El error de Stripe se pasa tal cual porque el primer intento SIEMPRE
        // falla con un mensaje muy concreto: hay que guardar una vez la
        // configuración del portal en el dashboard. Sin el detalle, eso se
        // diagnostica a ciegas.
        detalle: r.error.mensaje,
      },
      { status: 502, headers: SIN_CACHE }
    );
  }

  return Response.json({ ok: true, url: r.data.url }, { headers: SIN_CACHE });
}

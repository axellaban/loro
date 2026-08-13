// Arranca el pago con tarjeta: crea la sesión de Checkout y devuelve su URL.
//
// Por qué Checkout y no un formulario de tarjeta propio: alojado por Stripe, la
// tarjeta nunca toca este servidor y el alcance de PCI baja a SAQ A. Además
// trae 3D Secure, Apple/Google Pay y los medios locales sin escribir una línea
// — que para Latinoamérica es la diferencia entre cobrar y no cobrar.

import { rateLimit, sameOriginStrict } from "../../../lib/ratelimit";
import { sesionDeRequest } from "../../../lib/session";
import { clienteDeCuenta } from "../../../lib/passStore";
import { disponible, esPlan, motivoNoDisponible, origenDe, priceId, stripeApi } from "../../../lib/stripe";

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
  // 10/min: alcanza para dudar, volver y reintentar, y corta que alguien nos
  // haga crear sesiones de Checkout en loop.
  const rl = rateLimit(req, "stripe-checkout", 10, 60_000);
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

  let plan: unknown;
  try {
    plan = (await req.json())?.plan;
  } catch {
    return Response.json({ ok: false, error: "Body inválido." }, { status: 400, headers: SIN_CACHE });
  }
  if (!esPlan(plan)) {
    return Response.json({ ok: false, error: "Plan desconocido." }, { status: 400, headers: SIN_CACHE });
  }

  const price = priceId(plan);
  if (!price) {
    return Response.json(
      {
        ok: false,
        error: "El pago con tarjeta no está configurado en el servidor.",
        ayuda: `Falta STRIPE_PRICE_${plan.toUpperCase()} en este deploy. Corré scripts/stripe-setup.mjs y cargá lo que imprime.`,
      },
      { status: 503, headers: SIN_CACHE }
    );
  }

  const origen = origenDe(req);
  const sesion = await sesionDeRequest(req);

  // Si ya compró alguna vez, se reusa su cliente de Stripe. Sin esto cada
  // compra crea un cliente nuevo con el mismo email, y el portal de
  // facturación termina mostrando media historia: la del último cliente.
  const clienteExistente = sesion ? await clienteDeCuenta(sesion.sub) : null;

  const r = await stripeApi<{ id: string; url: string }>("/checkout/sessions", {
    params: {
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      // Vuelve por /api/stripe/return, que verifica el pago y redirige a la app
      // con el pase puesto. La app no recibe nunca un `?pase=` que no haya
      // salido de un cobro confirmado.
      success_url: `${origen}/api/stripe/return?cs={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origen}/app?pago=cancelado`,
      // `client_reference_id` es el único campo que Checkout devuelve intacto
      // en el webhook: es cómo el pase termina atado a la cuenta de Google de
      // quien pagó, aunque el webhook llegue cuando ya cerró la pestaña.
      client_reference_id: sesion?.sub || undefined,
      // Uno u otro, nunca los dos: Stripe rechaza `customer_email` si además
      // se le pasa un `customer`. Con el email precargado, quien ya entró con
      // Google no lo tiene que tipear de nuevo.
      //
      // (No va `customer_creation`: en modo suscripción Stripe siempre crea el
      // cliente, y ese parámetro solo existe para `mode: payment` — mandarlo
      // acá hace fallar el Checkout entero.)
      ...(clienteExistente
        ? { customer: clienteExistente }
        : { customer_email: sesion?.email || undefined }),
      allow_promotion_codes: true,
      locale: "es",
      // El plan viaja en los dos lados a propósito: `metadata` lo trae el
      // evento de Checkout, `subscription_data.metadata` lo traen las facturas
      // de TODAS las renovaciones futuras, que es donde no hay sesión de
      // Checkout de dónde sacarlo.
      metadata: { plan },
      subscription_data: { metadata: { plan } },
    },
  });

  if (!r.ok) {
    return Response.json(
      { ok: false, error: "No se pudo iniciar el pago. Probá de nuevo en un momento.", detalle: r.error.mensaje },
      { status: 502, headers: SIN_CACHE }
    );
  }

  return Response.json({ ok: true, url: r.data.url }, { headers: SIN_CACHE });
}

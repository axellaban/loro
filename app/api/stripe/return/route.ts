// La vuelta de Checkout: se confirma el cobro y se entra a la app con el pase.
//
// Este endpoint existe para que quien pagó tenga su acceso EN EL ACTO, sin
// depender de que el webhook haya llegado todavía. Los dos caminos emiten el
// mismo código (ver lib/stripePases.ts: el token es determinístico), así que
// cuál gane la carrera no cambia nada.
//
// El `session_id` que Stripe pone en la URL no se cree: se usa para PREGUNTARLE
// a Stripe si esa sesión está paga. La diferencia importa — un id de Checkout
// es visible para quien pagó, y si alcanzara con presentarlo, cualquiera que
// se lo copie de la barra de direcciones a un amigo le estaría regalando un
// pase. Lo que se verifica es el estado que devuelve la API, no el parámetro.

import { rateLimit } from "../../../lib/ratelimit";
import { origenDe, esPlan, stripeApi, type StripePlan } from "../../../lib/stripe";
import { emitirPase, linkDePase, vencimientoDe } from "../../../lib/stripePases";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/** Vuelve a la app diciendo qué pasó, sin pase. La app muestra el aviso y sigue. */
function aLaApp(origen: string, estado: string): Response {
  return Response.redirect(`${origen}/app?pago=${estado}`, 303);
}

export async function GET(req: Request) {
  const origen = origenDe(req);
  const url = new URL(req.url);
  const cs = url.searchParams.get("cs") || "";

  // 30/min: es una redirección que la gente recarga cuando duda si funcionó.
  const rl = rateLimit(req, "stripe-return", 30, 60_000);
  if (!rl.ok) return aLaApp(origen, "reintenta");

  // Los ids de Checkout son `cs_test_…` / `cs_live_…`. Filtrar acá evita
  // mandarle a Stripe cualquier cosa que alguien escriba en la URL.
  if (!/^cs_[A-Za-z0-9_]+$/.test(cs)) return aLaApp(origen, "invalido");

  const secret = process.env.PASS_SECRET;
  if (!secret) {
    // El cobro salió bien pero no podemos firmar el pase. Es un error de
    // deploy, no de la persona: se la manda a la app con un aviso claro en vez
    // de dejarla en una pantalla en blanco pensando que perdió la plata.
    console.error("[stripe/return] cobro confirmado pero falta PASS_SECRET");
    return aLaApp(origen, "sin-pase");
  }

  const r = await stripeApi<any>(`/checkout/sessions/${cs}`, {
    method: "GET",
    params: { "expand[0]": "subscription" },
  });
  if (!r.ok) return aLaApp(origen, "error");

  const s = r.data;
  // `paid` es el caso normal; `no_payment_required` es un cupón del 100%, que
  // también da acceso. Cualquier otra cosa todavía no se cobró.
  if (s?.status !== "complete" || !["paid", "no_payment_required"].includes(s?.payment_status)) {
    return aLaApp(origen, "pendiente");
  }

  const email = s?.customer_details?.email || s?.customer_email || "";
  if (!email) {
    console.error("[stripe/return] sesión paga sin email:", cs);
    return aLaApp(origen, "sin-email");
  }

  const planRaw = s?.metadata?.plan ?? s?.subscription?.metadata?.plan;
  const plan: StripePlan = esPlan(planRaw) ? planRaw : "week";

  const pase = await emitirPase(
    {
      email,
      plan,
      expiresAt: vencimientoDe(s?.subscription, plan),
      sub: s?.client_reference_id || null,
      customerId: typeof s?.customer === "string" ? s.customer : s?.customer?.id || null,
    },
    secret
  );
  if (!pase) return aLaApp(origen, "sin-pase");

  // 303 y no 302: obliga al navegador a hacer un GET limpio, así el pase no
  // queda enganchado a un reenvío del método original.
  return Response.redirect(linkDePase(origen, pase.token), 303);
}

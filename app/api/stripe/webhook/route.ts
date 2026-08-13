// Los avisos de Stripe: cada cobro confirmado se convierte en un pase.
//
// Es la única fuente de verdad para las RENOVACIONES. El redirect de vuelta de
// Checkout cubre la primera compra porque la persona está mirando la pantalla;
// el mes (o la semana) siguiente no hay nadie mirando nada, y el pase nuevo
// tiene que salir igual. Por eso este endpoint no es opcional: sin él se cobra
// la renovación y el acceso se corta.
//
// Tres cosas que hacen que esto sea seguro y aburrido, que es como tiene que
// ser un webhook:
//
//  - No hay guard de mismo-origen. Stripe no es mismo-origen: la autenticación
//    es la firma, y punto. Poner sameOriginStrict acá rechazaría TODOS los
//    eventos legítimos, que es un modo muy caro de romper las renovaciones.
//  - Se lee el cuerpo CRUDO con `req.text()`. Parsear y re-serializar cambia
//    el espaciado y la firma deja de cerrar.
//  - Reprocesar un evento es inofensivo: el pase que se emite es
//    determinístico (mismo pago → mismo código) y todo lo que se guarda es un
//    SET. Stripe reintenta cuando duda, y acá reintentar no duplica nada.

import { esPlan, stripeApi, verificarFirma, type StripePlan } from "../../../lib/stripe";
import { emitirPase, vencimientoDe } from "../../../lib/stripePases";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * Qué plan es este cobro, buscándolo en todos los lados donde puede estar.
 *
 * La metadata del plan se pone al crear el Checkout y Stripe la copia hacia
 * abajo, pero no al mismo campo en cada tipo de evento. Buscar en orden es más
 * corto que un `if` por tipo de objeto, y si no está en ninguno cae a "week",
 * que es el plan más barato: ante la duda conviene equivocarse dando de menos
 * y corregirlo a mano, nunca regalando un año.
 */
function planDe(...candidatos: unknown[]): StripePlan {
  for (const c of candidatos) if (esPlan(c)) return c;
  return "week";
}

export async function POST(req: Request) {
  const cuerpo = await req.text();
  const firma = await verificarFirma(
    cuerpo,
    req.headers.get("stripe-signature"),
    process.env.STRIPE_WEBHOOK_SECRET
  );
  if (!firma.ok) {
    console.error("[stripe/webhook] rechazado:", firma.motivo);
    // 400 y no 500: es un pedido inválido, no un fallo nuestro. Stripe no lo
    // reintenta, que es lo correcto — reintentar algo mal firmado no lo va a
    // arreglar.
    return Response.json({ ok: false, error: firma.motivo }, { status: 400 });
  }

  const evento = firma.evento;
  const obj = evento?.data?.object;

  const secret = process.env.PASS_SECRET;
  if (!secret) {
    // Se responde 500 A PROPÓSITO. Es el único caso donde queremos que Stripe
    // reintente: el cobro ya ocurrió y el pase no se pudo firmar, así que la
    // cola de reintentos de Stripe es literalmente lo que salva el acceso de
    // quien pagó mientras se carga la variable y se redeploya.
    console.error("[stripe/webhook] falta PASS_SECRET: no se puede emitir el pase");
    return Response.json({ ok: false, error: "PASS_SECRET no configurado." }, { status: 500 });
  }

  try {
    switch (evento?.type) {
      // ---------- Primera compra ----------
      //
      // Respaldo del redirect: cubre a quien cierra la pestaña apenas paga, o
      // vuelve con la red cortada. Emite exactamente el mismo código.
      case "checkout.session.completed": {
        if (!["paid", "no_payment_required"].includes(obj?.payment_status)) break;
        const email = obj?.customer_details?.email || obj?.customer_email || "";
        if (!email) break;

        const plan = planDe(obj?.metadata?.plan);
        // El evento trae la suscripción como id, sin expandir. Hay que pedirla
        // para saber hasta cuándo pagó: es la fecha que le va a durar el pase.
        let suscripcion: any = null;
        if (typeof obj?.subscription === "string") {
          const s = await stripeApi<any>(`/subscriptions/${obj.subscription}`, { method: "GET" });
          if (s.ok) suscripcion = s.data;
        }

        await emitirPase(
          {
            email,
            plan: planDe(suscripcion?.metadata?.plan, plan),
            expiresAt: vencimientoDe(suscripcion, plan),
            sub: obj?.client_reference_id || null,
            customerId: typeof obj?.customer === "string" ? obj.customer : null,
          },
          secret
        );
        break;
      }

      // ---------- Renovaciones y facturas ----------
      //
      // `invoice.paid` es el evento que importa de verdad. Cubre los dos
      // caminos que terminan en plata cobrada:
      //   - la renovación automática de una suscripción, y
      //   - una factura enviada a mano (/api/stripe/invoice), que es como se
      //     le cobra a una empresa que pide factura y paga por transferencia.
      case "invoice.paid": {
        const email = obj?.customer_email || obj?.customer_details?.email || "";
        if (!email) break;

        const linea = obj?.lines?.data?.[0];
        const plan = planDe(
          obj?.subscription_details?.metadata?.plan,
          obj?.metadata?.plan,
          linea?.metadata?.plan
        );

        await emitirPase(
          {
            email,
            plan,
            // Una factura de suscripción trae el período que se pagó; una
            // factura suelta no tiene período, y ahí `vencimientoDe` cae a los
            // días del plan contados desde ahora.
            expiresAt: vencimientoDe(linea, plan),
            customerId: typeof obj?.customer === "string" ? obj.customer : null,
          },
          secret
        );
        break;
      }

      // ---------- Cosas que solo se miran ----------
      //
      // No hay nada que revocar: el pase lleva su propio vencimiento y se apaga
      // solo el día en que termina el período pago. Quien cancela conserva lo
      // que pagó, que es lo correcto y no cuesta una línea de código.
      case "customer.subscription.deleted":
        console.log(`[stripe/webhook] baja de ${obj?.customer}; el pase vence solo al fin del período`);
        break;

      case "invoice.payment_failed":
        // Stripe reintenta según las reglas de cobro de la cuenta y le avisa a
        // la persona. Queda en el log para poder mirarlo cuando alguien
        // escribe diciendo que "le dejó de andar".
        console.warn(`[stripe/webhook] pago fallido de ${obj?.customer_email || obj?.customer}`);
        break;

      default:
        // Los eventos que no nos interesan se aceptan igual: responder algo
        // distinto de 2xx hace que Stripe reintente y termine deshabilitando
        // el endpoint por "fallas repetidas".
        break;
    }
  } catch (err: any) {
    // 500 para que Stripe reintente. Un error acá casi siempre es transitorio
    // (Upstash lento, Stripe con hipo) y el reintento lo resuelve solo.
    console.error(`[stripe/webhook] ${evento?.type} falló:`, err?.message || err);
    return Response.json({ ok: false }, { status: 500 });
  }

  return Response.json({ ok: true });
}

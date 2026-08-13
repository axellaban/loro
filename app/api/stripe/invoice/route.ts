// Facturar a mano: le manda una factura por email a alguien y, cuando la paga,
// el pase sale solo.
//
// Para qué sirve, concretamente: en Latinoamérica la venta B2B no entra por
// tarjeta. Una empresa que quiere pases para su equipo de RR.HH. pide factura,
// la pasa por administración y paga por transferencia a los 15 días. Esto es
// exactamente eso — factura con vencimiento, link de pago, recibo automático y
// el alta sin que nadie tenga que acordarse de hacerla.
//
// Es un endpoint de ADMINISTRACIÓN, no de la app. Lo llamo yo desde la
// terminal (`scripts/facturar.mjs`) y está detrás de un secreto propio: emitir
// facturas a nombre del negocio no es algo que pueda disparar el navegador de
// nadie.

import { rateLimit } from "../../../lib/ratelimit";
import {
  CATALOGO,
  MONEDA,
  disponible,
  esPlan,
  motivoNoDisponible,
  stripeApi,
  type StripePlan,
} from "../../../lib/stripe";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const SIN_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Content-Type": "application/json; charset=utf-8",
} as const;

/** Plazo de pago por default. 15 días es lo que tarda una administración normal. */
const DIAS_PARA_PAGAR = 15;

/** Comparación de tiempo constante para el secreto de administración. */
function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request) {
  // Sin guard de mismo-origen: esto se llama desde la terminal, no desde el
  // navegador. Lo que autentica es el secreto.
  const rl = rateLimit(req, "stripe-invoice", 20, 60_000);
  if (!rl.ok) {
    return Response.json({ ok: false, error: "Demasiados intentos." }, { status: 429, headers: SIN_CACHE });
  }

  const esperado = process.env.STRIPE_ADMIN_SECRET?.trim();
  if (!esperado) {
    return Response.json(
      { ok: false, error: "Falta STRIPE_ADMIN_SECRET en este deploy: la facturación a mano está deshabilitada." },
      { status: 503, headers: SIN_CACHE }
    );
  }
  const dado = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!dado || !igualSeguro(dado, esperado)) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401, headers: SIN_CACHE });
  }

  if (!disponible()) {
    return Response.json({ ok: false, error: motivoNoDisponible() }, { status: 503, headers: SIN_CACHE });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Body inválido." }, { status: 400, headers: SIN_CACHE });
  }

  const email = String(body?.email || "").trim();
  if (!email || !email.includes("@")) {
    return Response.json({ ok: false, error: "Falta el email de quien recibe la factura." }, { status: 400, headers: SIN_CACHE });
  }
  const plan: StripePlan = esPlan(body?.plan) ? body.plan : "year";
  const cantidad = Math.max(1, Math.min(500, Number(body?.cantidad) || 1));
  const nombre = String(body?.nombre || "").trim() || undefined;
  const diasParaPagar = Math.max(1, Math.min(90, Number(body?.diasParaPagar) || DIAS_PARA_PAGAR));

  // El monto: el del catálogo salvo que se pida otro (descuento por volumen,
  // que es la conversación real cuando alguien compra 20 pases de una).
  const unitario = Number.isFinite(Number(body?.montoUsd))
    ? Math.round(Number(body.montoUsd) * 100)
    : CATALOGO[plan].centavos;
  if (unitario < 50) {
    return Response.json(
      { ok: false, error: "El monto mínimo que acepta Stripe es 0,50 USD." },
      { status: 400, headers: SIN_CACHE }
    );
  }

  // Una clave de idempotencia por pedido: si el script se corre dos veces por
  // un timeout, no se emiten dos facturas por lo mismo.
  const idem = String(body?.idempotencyKey || "").trim() || `inv-${email}-${plan}-${cantidad}-${unitario}`;

  // ---------- 1. El cliente ----------
  const buscado = await stripeApi<{ data: Array<{ id: string }> }>("/customers", {
    method: "GET",
    params: { email, limit: 1 },
  });
  if (!buscado.ok) {
    return Response.json({ ok: false, error: buscado.error.mensaje }, { status: 502, headers: SIN_CACHE });
  }
  let customer = buscado.data.data?.[0]?.id || "";
  if (!customer) {
    const c = await stripeApi<{ id: string }>("/customers", {
      params: { email, name: nombre },
      idempotencyKey: `cust-${idem}`,
    });
    if (!c.ok) return Response.json({ ok: false, error: c.error.mensaje }, { status: 502, headers: SIN_CACHE });
    customer = c.data.id;
  }

  // ---------- 2. La factura, vacía ----------
  //
  // El orden importa y es al revés de lo que uno escribiría. Si primero se
  // crean los ítems sueltos, quedan "pendientes" en el cliente y Stripe los
  // engancha a la PRÓXIMA factura que se emita — o sea, si esa persona además
  // tiene una suscripción, le llegan los pases de la empresa cobrados en la
  // renovación de su pase personal. Creando la factura primero y atando cada
  // ítem a ella con `invoice`, eso no puede pasar.
  const inv = await stripeApi<{ id: string }>("/invoices", {
    params: {
      customer,
      collection_method: "send_invoice",
      days_until_due: diasParaPagar,
      // Se finaliza a mano abajo, con /send. Con auto_advance Stripe podría
      // finalizarla por su cuenta antes de que le agreguemos los ítems.
      auto_advance: false,
      description: `Loreado.IA — ${CATALOGO[plan].titulo}${cantidad > 1 ? ` × ${cantidad}` : ""}`,
      // El plan viaja en la metadata porque es lo que lee el webhook de
      // `invoice.paid` para saber qué pase emitir. Sin esto, una factura
      // pagada emite el pase más barato.
      metadata: { plan, origen: "factura" },
      footer: "Gracias por confiar en Loreado.IA 🦜",
    },
    idempotencyKey: `inv-${idem}`,
  });
  if (!inv.ok) return Response.json({ ok: false, error: inv.error.mensaje }, { status: 502, headers: SIN_CACHE });

  // ---------- 3. El ítem, atado a esa factura ----------
  const item = await stripeApi<{ id: string }>("/invoiceitems", {
    params: {
      customer,
      invoice: inv.data.id,
      currency: MONEDA,
      unit_amount: unitario,
      quantity: cantidad,
      description: CATALOGO[plan].titulo,
      metadata: { plan },
    },
    idempotencyKey: `item-${idem}`,
  });
  if (!item.ok) return Response.json({ ok: false, error: item.error.mensaje }, { status: 502, headers: SIN_CACHE });

  // ---------- 4. Enviarla ----------
  //
  // `/send` finaliza la factura y le manda el email con el link de pago. A
  // partir de acá Stripe se encarga solo: recordatorios, recibo, y el webhook
  // de `invoice.paid` que emite el pase.
  const enviada = await stripeApi<any>(`/invoices/${inv.data.id}/send`, {
    idempotencyKey: `send-${idem}`,
  });
  if (!enviada.ok) {
    return Response.json(
      { ok: false, error: enviada.error.mensaje, facturaId: inv.data.id },
      { status: 502, headers: SIN_CACHE }
    );
  }

  return Response.json(
    {
      ok: true,
      facturaId: enviada.data.id,
      numero: enviada.data.number,
      total: (enviada.data.total ?? unitario * cantidad) / 100,
      moneda: MONEDA,
      vence: enviada.data.due_date ? new Date(enviada.data.due_date * 1000).toISOString() : null,
      link: enviada.data.hosted_invoice_url,
      pdf: enviada.data.invoice_pdf,
    },
    { headers: SIN_CACHE }
  );
}

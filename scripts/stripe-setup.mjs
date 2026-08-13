#!/usr/bin/env node
// Crea en Stripe el producto y los dos precios de los pases, y te imprime las
// variables listas para pegar en Vercel.
//
//   node scripts/stripe-setup.mjs               → usa STRIPE_SECRET_KEY del entorno / .env.local
//   node scripts/stripe-setup.mjs sk_test_...   → usa la clave que le pases
//
// Se puede correr las veces que haga falta: busca por `lookup_key` antes de
// crear, así que la segunda corrida no duplica nada — te vuelve a imprimir los
// mismos IDs. Eso importa porque esto se corre DOS veces en la vida del
// proyecto: una con la clave de test y otra con la de producción, y los IDs
// que salen son distintos en cada modo.
//
// El catálogo (títulos y precios) sale de app/lib/stripe.ts, que es de donde lo
// lee también la app: si cambiás un precio ahí y volvés a correr esto, se crea
// el precio nuevo. Los precios de Stripe son inmutables a propósito —no se
// edita el monto de uno existente, se crea otro— así que el `lookup_key` viejo
// se libera solo al reasignarlo.

import { readFileSync } from "node:fs";
import { CATALOGO, MONEDA } from "../app/lib/stripe.ts";

const API = "https://api.stripe.com/v1";
const API_VERSION = "2024-06-20";

/** El mismo nombre estable con el que se busca cada precio en las próximas corridas. */
const LOOKUP = { week: "loreado_pase_week", year: "loreado_pase_year" };

function clave() {
  const arg = process.argv[2];
  if (arg?.startsWith("sk_")) return arg.trim();
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY.trim();
  for (const f of [".env.local", ".env"]) {
    try {
      const m = readFileSync(new URL(`../${f}`, import.meta.url), "utf8").match(
        /^STRIPE_SECRET_KEY\s*=\s*(.+)$/m
      );
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch {}
  }
  console.error(
    "Falta STRIPE_SECRET_KEY.\n" +
      "  Pasala como argumento, ponela en .env.local o exportala.\n" +
      "  La sacás de https://dashboard.stripe.com/apikeys"
  );
  process.exit(1);
}

const KEY = clave();
const TEST = KEY.startsWith("sk_test_");

function encode(obj, prefijo = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const c = prefijo ? `${prefijo}[${k}]` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) encode(v, c, out);
    else out.append(c, String(v));
  }
  return out;
}

async function api(path, params, method = "POST") {
  const body = encode(params || {});
  const url = method === "GET" ? `${API}${path}?${body}` : `${API}${path}`;
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Stripe-Version": API_VERSION,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(method === "POST" ? { body: body.toString() } : {}),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    console.error(`\n✗ Stripe rechazó ${method} ${path}:\n  ${j?.error?.message || r.status}`);
    process.exit(1);
  }
  return j;
}

console.log(`\nConectando a Stripe en modo ${TEST ? "TEST" : "LIVE"}…`);

// ---------- El producto ----------
//
// Uno solo, con dos precios colgando. Es lo que corresponde: es el mismo pase,
// facturado con dos frecuencias distintas. Dos productos separados partirían
// los reportes de ingresos en dos y no dejarían a nadie cambiar de plan sin
// dar de baja y volver a comprar.
const productos = await api("/products/search", { query: `metadata['app']:'loreado'`, limit: 1 }, "GET");
let producto = productos.data?.[0];
if (!producto) {
  producto = await api("/products", {
    name: "Pase Rey Loro Ilimitado",
    description: "Acceso ilimitado al copiloto de entrevistas de Loreado.IA",
    metadata: { app: "loreado" },
  });
  console.log(`  producto creado: ${producto.id}`);
} else {
  console.log(`  producto que ya existía: ${producto.id}`);
}

// ---------- Los precios ----------
const ids = {};
for (const [plan, { titulo, centavos, intervalo }] of Object.entries(CATALOGO)) {
  const lookup = LOOKUP[plan];
  const existentes = await api("/prices", { lookup_keys: { 0: lookup }, limit: 1 }, "GET");
  const previo = existentes.data?.[0];

  // Se reusa solo si además coincide el monto. Si el precio del catálogo
  // cambió, hay que crear uno nuevo: en Stripe el monto de un precio no se
  // edita, y seguir usando el viejo sería cobrar algo distinto de lo que dice
  // la web.
  if (previo && previo.unit_amount === centavos && previo.recurring?.interval === intervalo) {
    ids[plan] = previo.id;
    console.log(`  precio ${plan}: ${previo.id} (ya existía, ${(centavos / 100).toFixed(2)} ${MONEDA.toUpperCase()}/${intervalo})`);
    continue;
  }

  const creado = await api("/prices", {
    product: producto.id,
    currency: MONEDA,
    unit_amount: centavos,
    recurring: { interval: intervalo },
    nickname: titulo,
    lookup_key: lookup,
    // Le saca el lookup_key al precio viejo para dárselo a este. Sin esto la
    // creación falla con "lookup_key ya en uso" y hay que entrar al dashboard.
    transfer_lookup_key: Boolean(previo),
    metadata: { app: "loreado", plan },
  });
  ids[plan] = creado.id;
  console.log(`  precio ${plan}: ${creado.id} (nuevo, ${(centavos / 100).toFixed(2)} ${MONEDA.toUpperCase()}/${intervalo})`);
}

console.log(`
────────────────────────────────────────────────────────────
Pegá esto en Vercel → Settings → Environment Variables
(y en .env.local para probar localmente):

STRIPE_PRICE_WEEK=${ids.week}
STRIPE_PRICE_YEAR=${ids.year}

Falta todavía, y sin esto NO se emite ningún pase:

  1. El webhook. En https://dashboard.stripe.com/${TEST ? "test/" : ""}webhooks
     → "Add endpoint" → URL:

         https://loreado.vercel.app/api/stripe/webhook

     Eventos a escuchar (solo estos cuatro):
         checkout.session.completed
         invoice.paid
         invoice.payment_failed
         customer.subscription.deleted

     Copiá el "Signing secret" (whsec_…) a STRIPE_WEBHOOK_SECRET.

  2. El portal de facturación, UNA sola vez, en
     https://dashboard.stripe.com/${TEST ? "test/" : ""}settings/billing/portal
     → Guardar. Hasta que no lo guardes, /api/stripe/portal devuelve error.

  3. REDEPLOYÁ. Las variables nuevas no entran en un deploy ya hecho.

Después, para chequear que quedó todo:  curl https://loreado.vercel.app/api/stripe
────────────────────────────────────────────────────────────
${TEST ? "⚠  Esto quedó en modo TEST: los cobros son de mentira.\n   Repetí todo con la clave sk_live_ cuando vayas a cobrar de verdad.\n" : ""}`);

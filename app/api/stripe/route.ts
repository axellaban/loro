// ¿Este deploy puede cobrar?
//
// Mismo criterio que el GET de /api/pass, y por la misma razón: en Vercel una
// variable nueva NO entra en los deploys que ya estaban corriendo, hay que
// redeployar. Sin un lugar donde mirarlo, "el botón de pagar no hace nada" se
// ve igual que "falta la clave" y que "cargué la clave pero no redeployé".
//
// Nunca devuelve claves ni nada derivado de ellas: solo booleanos y el prefijo
// de los IDs de precio, que no son secretos (viajan en la sesión de Checkout).

import * as kv from "../../lib/kv";
import { disponible, esModoTest, priceId } from "../../lib/stripe";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const SIN_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Content-Type": "application/json; charset=utf-8",
} as const;

export async function GET() {
  const claveCargada = disponible();
  const webhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  const week = priceId("week");
  const year = priceId("year");

  const faltan: string[] = [];
  if (!claveCargada) faltan.push("STRIPE_SECRET_KEY");
  if (!webhook) faltan.push("STRIPE_WEBHOOK_SECRET");
  if (!week) faltan.push("STRIPE_PRICE_WEEK");
  if (!year) faltan.push("STRIPE_PRICE_YEAR");
  if (!process.env.PASS_SECRET) faltan.push("PASS_SECRET");

  return Response.json(
    {
      cobrosConfigurados: faltan.length === 0,
      // El aviso más importante de todos: con una clave de test, los pagos son
      // de mentira. Es exactamente el error que se descubre tarde y mal —
      // cuando alguien avisa que compró y en el dashboard no hay nada.
      modo: claveCargada ? (esModoTest() ? "TEST (los cobros son de mentira)" : "LIVE") : "sin clave",
      claveCargada,
      // Sin esto se cobra pero no se emite ningún pase en las renovaciones.
      webhookConfigurado: webhook,
      precios: { week: week || null, year: year || null },
      // Los pases se firman con PASS_SECRET: sin él, un cobro exitoso no puede
      // convertirse en acceso.
      pasesConfigurados: Boolean(process.env.PASS_SECRET),
      // Sin Upstash el pase se emite igual, pero no queda anotado: quien pagó
      // no lo recupera entrando con Google desde otro dispositivo, y las
      // renovaciones no le llegan solas.
      pasesEntreDispositivos: kv.disponible(),
      facturacionAMano: Boolean(process.env.STRIPE_ADMIN_SECRET?.trim()),
      faltan: faltan.length ? faltan : undefined,
      ayuda: faltan.length
        ? `Faltan ${faltan.join(", ")} en este deploy. Cargalas en Vercel y REDEPLOYÁ: las variables nuevas no entran en un deploy ya hecho. Los IDs de precio los imprime scripts/stripe-setup.mjs.`
        : undefined,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "desconocido",
    },
    { headers: SIN_CACHE }
  );
}

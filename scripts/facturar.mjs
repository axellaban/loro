#!/usr/bin/env node
// Le manda una factura por email a alguien. Cuando la paga, el pase sale solo.
//
//   node scripts/facturar.mjs rrhh@empresa.com                    → 1 pase anual
//   node scripts/facturar.mjs rrhh@empresa.com year 20            → 20 pases anuales
//   node scripts/facturar.mjs rrhh@empresa.com year 20 --usd 69   → con descuento por volumen
//   node scripts/facturar.mjs rrhh@empresa.com week 1 --nombre "Acme SA" --dias 30
//
// Es el camino para vender B2B en la región: la empresa no paga con tarjeta,
// pide factura, la pasa por administración y transfiere. Stripe se encarga del
// email, el link de pago, los recordatorios y el recibo; el alta la hace el
// webhook de `invoice.paid` sin que nadie tenga que acordarse.
//
// Habla con el deploy, no con Stripe: así la factura sale con la misma
// configuración con la que después se va a emitir el pase, y no hay forma de
// que la terminal y el servidor tengan ideas distintas de cuánto vale un pase.

import { readFileSync } from "node:fs";

const BASE_URL = (process.env.LOREADO_URL || "https://loreado.vercel.app").replace(/\/+$/, "");

function delEntorno(nombre, ayuda) {
  if (process.env[nombre]) return process.env[nombre].trim();
  for (const f of [".env.local", ".env"]) {
    try {
      const m = readFileSync(new URL(`../${f}`, import.meta.url), "utf8").match(
        new RegExp(`^${nombre}\\s*=\\s*(.+)$`, "m")
      );
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch {}
  }
  console.error(`Falta ${nombre}.\n  ${ayuda}`);
  process.exit(1);
}

// --- argumentos ---
const args = process.argv.slice(2);
const flags = {};
const sueltos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) flags[args[i].slice(2)] = args[++i];
  else sueltos.push(args[i]);
}

const [email, planArg, cantidadArg] = sueltos;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(
    "Uso: node scripts/facturar.mjs <email> [week|year] [cantidad] [--usd <precio unitario>] [--nombre \"Razón Social\"] [--dias <plazo>]"
  );
  process.exit(1);
}

const plan = planArg === "week" ? "week" : "year";
const cantidad = cantidadArg ? parseInt(cantidadArg, 10) : 1;
if (!Number.isFinite(cantidad) || cantidad < 1) {
  console.error("La cantidad tiene que ser un número mayor a 0.");
  process.exit(1);
}

const secreto = delEntorno(
  "STRIPE_ADMIN_SECRET",
  "Es el mismo valor que está cargado en Vercel. Para crear uno: openssl rand -base64 32"
);

console.log(`\nFacturando a ${email} — ${cantidad} × pase ${plan}…`);

const r = await fetch(`${BASE_URL}/api/stripe/invoice`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${secreto}` },
  body: JSON.stringify({
    email,
    plan,
    cantidad,
    nombre: flags.nombre,
    montoUsd: flags.usd ? Number(flags.usd) : undefined,
    diasParaPagar: flags.dias ? Number(flags.dias) : undefined,
    // Sin esto, correr el comando dos veces por un timeout emite dos facturas
    // por lo mismo. Con la fecha adentro, facturarle de nuevo al mismo cliente
    // otro día sí funciona, que es lo que queremos.
    idempotencyKey: `cli-${email}-${plan}-${cantidad}-${flags.usd || "lista"}-${new Date().toISOString().slice(0, 10)}`,
  }),
});

const j = await r.json().catch(() => null);
if (!r.ok || !j?.ok) {
  console.error(`\n✗ No se pudo emitir la factura (${r.status}): ${j?.error || "sin detalle"}`);
  if (r.status === 401) console.error("  El STRIPE_ADMIN_SECRET de acá no coincide con el del deploy.");
  if (r.status === 503) console.error("  Chequeá el estado del deploy: " + `${BASE_URL}/api/stripe`);
  process.exit(1);
}

console.log(`
✓ Factura ${j.numero || j.facturaId} enviada a ${email}

  Total:  ${j.total} ${String(j.moneda).toUpperCase()}
  Vence:  ${j.vence ? new Date(j.vence).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }) : "sin vencimiento"}
  Link:   ${j.link}
  PDF:    ${j.pdf}

Ya le llegó el email con el link de pago. Cuando pague, el pase se emite solo y
lo recibe entrando con Google con este mismo email (${email}).
`);

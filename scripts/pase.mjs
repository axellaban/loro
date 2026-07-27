#!/usr/bin/env node
// Genera un pase ilimitado para alguien que ya pagó.
//
//   node scripts/pase.mjs axel@mail.com          → pase de 7 días
//   node scripts/pase.mjs axel@mail.com year     → pase de 12 meses
//   node scripts/pase.mjs axel@mail.com 30       → pase de 30 días
//
// Imprime el link listo para pegar en WhatsApp. El secreto sale de PASS_SECRET
// (variable de entorno o .env.local) y tiene que ser EL MISMO que está cargado
// en Vercel; si no, el pase no va a validar en producción.

import { readFileSync } from "node:fs";
import { createPass, PLAN_DAYS } from "../app/lib/pass.ts";

const BASE_URL = process.env.LOREADO_URL || "https://loreado.vercel.app";

function secreto() {
  if (process.env.PASS_SECRET) return process.env.PASS_SECRET.trim();
  // Comodidad: leer .env.local para no tener que exportar la variable a mano.
  for (const f of [".env.local", ".env"]) {
    try {
      const m = readFileSync(new URL(`../${f}`, import.meta.url), "utf8").match(
        /^PASS_SECRET\s*=\s*(.+)$/m
      );
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch {}
  }
  console.error(
    "Falta PASS_SECRET.\n" +
      "  Ponelo en .env.local (PASS_SECRET=...) o exportalo antes de correr esto.\n" +
      "  Tiene que ser el mismo valor que está cargado en Vercel.\n\n" +
      "  Para crear uno nuevo:  openssl rand -base64 32"
  );
  process.exit(1);
}

const [email, arg] = process.argv.slice(2);
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Uso: node scripts/pase.mjs <email> [week|year|<días>]");
  process.exit(1);
}

const plan = arg === "year" ? "year" : "week";
const dias = arg && /^\d+$/.test(arg) ? parseInt(arg, 10) : PLAN_DAYS[plan];
if (!Number.isFinite(dias) || dias < 1 || dias > 3650) {
  console.error("Los días tienen que ser un número entre 1 y 3650.");
  process.exit(1);
}

const expiresAt = Date.now() + dias * 24 * 60 * 60 * 1000;
const token = await createPass({ email, expiresAt, plan }, secreto());
const link = `${BASE_URL}/app?pase=${encodeURIComponent(token)}`;
const vence = new Date(expiresAt).toLocaleDateString("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

console.log(`
Pase para ${email} — ${dias} días, vence el ${vence}

MANDALE ESTO POR WHATSAPP:
─────────────────────────────────────────────
Listo! 🦜👑 Tu Pase Rey Loro ya está activo.

Abrí este link y el Loro queda ilimitado hasta el ${vence}:
${link}

Con eso las sesiones no se cortan y no tenés tope. Cualquier cosa me escribís por acá.
─────────────────────────────────────────────

Si necesitás el código suelto (para pegarlo en "¿Tenés un pase?"), es la línea
de abajo entera — sin espacios ni nada alrededor:

${token}
`);

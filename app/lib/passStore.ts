// Qué pase tiene cada cuenta de Google.
//
// Dos claves por pase, cada una contestando una pregunta distinta:
//
//   pase:cuenta:<sub>     → el código de esta cuenta
//        Es la que hace que el pase te siga entre dispositivos: entrás con
//        Google en el celular y el servidor te devuelve tu código.
//
//   pase:reclamo:<huella> → qué cuenta se quedó con este código
//        Es la que hace que un código valga para UNA sola cuenta. Sin ella el
//        mismo código reenviado por WhatsApp lo usa todo un grupo.
//
// El código nunca se guarda en claro del lado del reclamo: alcanza con su
// huella para saber si ya fue usado, y así lo que hay en la base no sirve para
// entrar a la app.

import * as kv from "./kv";

/** Margen sobre el vencimiento del pase, para que la clave no muera antes que él. */
const MARGEN_MS = 30 * 24 * 60 * 60 * 1000;

function ttl(expiresAt: number): number {
  return Math.max(60, Math.floor((expiresAt + MARGEN_MS - Date.now()) / 1000));
}

/** El código de esta cuenta, si canjeó alguno. */
export async function pasePorCuenta(sub: string): Promise<string | null> {
  if (!kv.disponible() || !sub) return null;
  return kv.get(`pase:cuenta:${sub}`);
}

export type Reclamo =
  | { ok: true }
  | { ok: false; motivo: string };

/**
 * Ata un código a una cuenta. El primero que llega se lo queda.
 *
 * Si la misma cuenta vuelve a canjear el mismo código no pasa nada: es lo que
 * ocurre al abrir el link de nuevo, y sería absurdo rechazarlo.
 */
export async function reclamar(
  sub: string,
  token: string,
  expiresAt: number
): Promise<Reclamo> {
  // Sin almacenamiento no hay nada que atar; el pase sigue funcionando como
  // siempre. Es una degradación silenciosa a propósito: que falte la base de
  // Upstash no puede dejar afuera a alguien que pagó.
  if (!kv.disponible() || !sub) return { ok: true };

  const h = await kv.huella(token);
  const claveReclamo = `pase:reclamo:${h}`;
  const segundos = ttl(expiresAt);

  const gano = await kv.setIfAbsent(claveReclamo, sub, segundos);
  if (!gano) {
    const dueño = await kv.get(claveReclamo);
    // Si no se pudo leer quién es el dueño, se deja pasar. Preferimos que en
    // un fallo de la base entre alguien de más y no que quede afuera quien pagó.
    if (dueño && dueño !== sub) {
      return {
        ok: false,
        motivo:
          "Ese pase ya está activado en otra cuenta de Google. Cada pase vale para una sola cuenta — si es tuyo y perdiste el acceso, escribime y lo libero.",
      };
    }
  }

  await kv.set(`pase:cuenta:${sub}`, token, segundos);
  return { ok: true };
}

/**
 * Marca que a esta cuenta ya se le registró el email en el Google Form, y dice
 * si es la primera vez.
 *
 * Sin esto, cada vez que la persona entra desde un dispositivo nuevo —o
 * simplemente vuelve después de limpiar las cookies— se manda otra fila al
 * formulario, y la lista se llena del mismo email repetido. Usa SET NX para
 * que dos pestañas abiertas a la vez no cuenten como dos.
 *
 * Si no hay base, devuelve false: preferimos no registrar a registrar de más.
 */
export async function marcarRegistrado(sub: string): Promise<boolean> {
  if (!kv.disponible() || !sub) return false;
  // Un año: si alguien vuelve después de tanto, registrarlo de nuevo no molesta.
  return kv.setIfAbsent(`registrado:${sub}`, "1", 365 * 24 * 60 * 60);
}

/** Suelta el pase de una cuenta. Para cuando alguien pierde el acceso y hay que reasignarlo. */
export async function liberar(sub: string, token: string): Promise<void> {
  if (!kv.disponible()) return;
  await kv.del(`pase:cuenta:${sub}`);
  await kv.del(`pase:reclamo:${await kv.huella(token)}`);
}

// ---------- Pases emitidos por Stripe ----------
//
// Los pases que se venden por Stripe entran por otra puerta que los que activo
// a mano: cuando el webhook los emite, quien pagó puede no haber entrado nunca
// con Google, así que no hay `sub` con el cual atarlos. Lo único que sí
// tenemos siempre es el email con el que pagó.
//
// De ahí la clave por email: es el puente entre "pagó en Stripe" y "entró con
// Google" cuando esas dos cosas pasan en momentos distintos —que es el caso
// normal, porque el webhook llega mientras la persona todavía está en la
// pantalla de Stripe.
//
// El email se guarda hasheado por la misma razón que el token del reclamo: lo
// que quede en la base no tiene que servir para saber quién compró.

/** Normaliza el email antes de hashearlo: Stripe lo devuelve tal cual lo tipearon. */
function normalizarEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

/** Deja anotado el pase de quien pagó, para dárselo cuando entre con Google. */
export async function guardarPasePorEmail(
  email: string,
  token: string,
  expiresAt: number
): Promise<void> {
  const e = normalizarEmail(email);
  if (!kv.disponible() || !e) return;
  await kv.set(`pase:email:${await kv.huella(e)}`, token, ttl(expiresAt));
}

/** El pase que compró este email, si compró alguno. */
export async function pasePorEmail(email: string): Promise<string | null> {
  const e = normalizarEmail(email);
  if (!kv.disponible() || !e) return null;
  return kv.get(`pase:email:${await kv.huella(e)}`);
}

/**
 * Ata un pase a una cuenta sin pasar por `reclamar`.
 *
 * La diferencia importa: `reclamar` existe para que un código que circula por
 * WhatsApp se lo quede uno solo. Acá el emisor somos nosotros y sabemos a
 * quién le corresponde porque lo dice Stripe, así que no hay carrera que
 * resolver — y pasar por el NX sería peor: si el mismo pase se re-emite en la
 * renovación, el reclamo viejo lo rechazaría contra su propio dueño.
 */
export async function atarPaseACuenta(
  sub: string,
  token: string,
  expiresAt: number
): Promise<void> {
  if (!kv.disponible() || !sub) return;
  const segundos = ttl(expiresAt);
  await kv.set(`pase:cuenta:${sub}`, token, segundos);
  // El reclamo se escribe igual, para que el código no se pueda reenviar y
  // activar en otra cuenta. Si ya existía a nombre de este mismo sub, el NX
  // falla y no pasa nada: el dueño no cambió.
  await kv.setIfAbsent(`pase:reclamo:${await kv.huella(token)}`, sub, segundos);
}

/**
 * El cliente de Stripe de una cuenta, para abrirle el portal de facturación
 * sin tener que buscarlo por email en cada visita.
 *
 * Sin vencimiento corto: un cliente de Stripe no caduca, y perderlo significa
 * crear uno duplicado en la próxima compra —dos clientes con el mismo email,
 * cada uno con la mitad de las facturas—. Dos años cubre de sobra el pase más
 * largo que vendemos.
 */
const CLIENTE_TTL = 2 * 365 * 24 * 60 * 60;

export async function guardarCliente(sub: string, customerId: string): Promise<void> {
  if (!kv.disponible() || !sub || !customerId) return;
  await kv.set(`stripe:cliente:${sub}`, customerId, CLIENTE_TTL);
}

export async function clienteDeCuenta(sub: string): Promise<string | null> {
  if (!kv.disponible() || !sub) return null;
  return kv.get(`stripe:cliente:${sub}`);
}

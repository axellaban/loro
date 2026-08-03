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

/** Suelta el pase de una cuenta. Para cuando alguien pierde el acceso y hay que reasignarlo. */
export async function liberar(sub: string, token: string): Promise<void> {
  if (!kv.disponible()) return;
  await kv.del(`pase:cuenta:${sub}`);
  await kv.del(`pase:reclamo:${await kv.huella(token)}`);
}

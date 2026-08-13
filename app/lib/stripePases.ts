// De un pago de Stripe a un pase de Loreado.
//
// El punto de todo el integrado está acá y es una decisión de diseño, no un
// detalle: Stripe NO es el sistema de permisos. El sistema de permisos ya
// existe —el pase firmado de lib/pass.ts— y funciona sin base de datos, sin
// login y sin red. Stripe pasa a ser una máquina más de emitir esos pases,
// exactamente igual que el script que corro a mano cuando alguien paga por
// Mercado Pago.
//
// Consecuencias buenas de encararlo así:
//
//  - Si Stripe se cae, nadie que ya pagó pierde el acceso: su pase sigue
//    valiendo solo, porque lleva adentro su propio vencimiento.
//  - No hay que consultar el estado de la suscripción en cada pedido caro:
//    /api/answer sigue mirando el header del pase y nada más.
//  - Cancelar una suscripción no requiere ningún código de revocación. El pase
//    vence en `current_period_end`, así que quien cancela conserva el acceso
//    hasta el día que pagó y ni un minuto más. Es el comportamiento correcto y
//    sale gratis.
//
// La otra pieza fina: el token es DETERMINÍSTICO. `createPass` firma un
// payload que solo depende de (email, vencimiento, plan), y el vencimiento
// sale de Stripe —no de `Date.now()`—. Entonces el redirect de vuelta y el
// webhook, que corren en paralelo y sin saber uno del otro, generan el MISMO
// código. No hay pases duplicados, no hace falta un candado, y reintentar es
// gratis. Si el vencimiento saliera de la hora local, cada camino emitiría un
// pase distinto y la persona terminaría con dos códigos para el mismo pago.

import { createPass, type PassPlan } from "./pass";
import { atarPaseACuenta, guardarCliente, guardarPasePorEmail } from "./passStore";
import { PLAN_DIAS, type StripePlan } from "./stripe";

export type PaseEmitido = {
  token: string;
  email: string;
  expiresAt: number;
  plan: PassPlan;
};

/**
 * Margen sobre el fin del período facturado.
 *
 * Stripe cobra la renovación el mismo día que vence el período, y el webhook
 * de `invoice.paid` puede tardar. Sin este colchón, quien renueva se queda
 * unos minutos sin acceso justo mientras está pagando. Doce horas es
 * imperceptible para el negocio y suficiente para cualquier demora real.
 */
const GRACIA_MS = 12 * 60 * 60 * 1000;

/**
 * Emite el pase de un pago y lo deja anotado donde haga falta.
 *
 * `sub` es el id de la cuenta de Google, si la conocemos. Cuando el pago entra
 * por el webhook casi nunca la conocemos —la persona sigue en la pantalla de
 * Stripe— y por eso el email es el que siempre se guarda: es el puente para
 * cuando entre con Google más tarde.
 */
export async function emitirPase(
  datos: { email: string; expiresAt: number; plan: StripePlan; sub?: string | null; customerId?: string | null },
  secret: string
): Promise<PaseEmitido | null> {
  const email = String(datos.email || "").trim();
  if (!email || !datos.expiresAt) return null;

  const expiresAt = datos.expiresAt + GRACIA_MS;
  const plan: PassPlan = datos.plan;
  const token = await createPass({ email, expiresAt, plan }, secret);

  // Nunca se corta la emisión por un fallo de la base: el pase ya está firmado
  // y vale igual. Lo que guardamos es la comodidad de recuperarlo, no el pase.
  await guardarPasePorEmail(email, token, expiresAt).catch(() => {});
  if (datos.sub) {
    await atarPaseACuenta(datos.sub, token, expiresAt).catch(() => {});
    if (datos.customerId) await guardarCliente(datos.sub, datos.customerId).catch(() => {});
  }

  return { token, email, expiresAt, plan };
}

/**
 * Hasta cuándo vale lo que se pagó, según el objeto de Stripe que lo dice.
 *
 * Las suscripciones traen `current_period_end` en segundos, que es la fecha
 * exacta que queremos. Devuelve milisegundos porque es lo que usa el pase.
 *
 * El chequeo de "está en el futuro" no es paranoia defensiva: es el caso de una
 * factura suelta. En una línea de factura de un ítem único, Stripe pone
 * `period.start` y `period.end` en el MISMO instante —el de la creación—
 * porque no hay período que facturar. Tomándolo literal, el pase nacería
 * vencido y la persona pagaría una factura para no recibir nada. Cuando la
 * fecha no sirve se cae a los días del plan contados desde ahora, que es lo
 * correcto para una factura suelta.
 */
export function vencimientoDe(
  fuente: { current_period_end?: number; period?: { end?: number } } | null | undefined,
  plan: StripePlan,
  ahora: number = Date.now()
): number {
  const fin = fuente?.current_period_end ?? fuente?.period?.end;
  if (typeof fin === "number" && fin * 1000 > ahora) return fin * 1000;
  return ahora + PLAN_DIAS[plan] * 24 * 60 * 60 * 1000;
}

/** El link con el que se entra a la app ya con el pase puesto. */
export function linkDePase(origen: string, token: string): string {
  return `${origen}/app?pase=${encodeURIComponent(token)}`;
}

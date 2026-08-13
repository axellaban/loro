# Stripe en Loreado

Cobro con tarjeta (Billing) y facturación a empresas (Invoicing), sin tocar
el sistema de acceso que ya existía.

## La idea en una frase

**Stripe no decide quién entra.** Eso lo sigue decidiendo el pase firmado de
`app/lib/pass.ts`. Stripe es una máquina más de emitir esos pases, igual que
`scripts/pase.mjs` cuando alguien paga por Mercado Pago.

```
Checkout / Factura ──► cobro confirmado ──► se emite un PASE ──► la app lo lee
                                              (lib/stripePases.ts)
```

Lo que se gana con encararlo así:

| | |
|---|---|
| **Si Stripe se cae** | nadie que ya pagó pierde el acceso: el pase lleva su propio vencimiento adentro |
| **En cada pedido caro** | `/api/answer` no consulta nada: mira el header del pase, como siempre |
| **Al cancelar** | no hace falta código de revocación — el pase vence en `current_period_end`, así que se conserva lo pagado y ni un minuto más |
| **Reintentos** | el pase es determinístico (mismo pago → mismo código), así que reprocesar un webhook no duplica nada |

## Puesta en marcha

### 1. Crear el catálogo en Stripe

```bash
node scripts/stripe-setup.mjs sk_test_...
```

Crea el producto y los dos precios recurrentes (7 días y 12 meses), e imprime
`STRIPE_PRICE_WEEK` y `STRIPE_PRICE_YEAR` listos para pegar. Se puede correr
las veces que haga falta: busca antes de crear, no duplica.

Los precios salen de `CATALOGO` en `app/lib/stripe.ts`, que es la única fuente
de verdad — de ahí los lee también la facturación a mano.

### 2. El webhook

En [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/test/webhooks)
→ **Add endpoint**:

- URL: `https://loreado.vercel.app/api/stripe/webhook`
- Eventos (solo estos cuatro):
  - `checkout.session.completed`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `customer.subscription.deleted`

El *signing secret* (`whsec_…`) va a `STRIPE_WEBHOOK_SECRET`.

> **Sin webhook se cobra pero no se emite nada en las renovaciones.** La primera
> compra igual funciona (la cubre el redirect de vuelta), así que el problema no
> aparece hasta la segunda semana — y ahí aparece como "me cobraron y no entro".

### 3. El portal de facturación

Una vez, en
[settings/billing/portal](https://dashboard.stripe.com/test/settings/billing/portal)
→ **Guardar**. Hasta que no se guarde, `/api/stripe/portal` devuelve error.

### 4. Variables y redeploy

Cargar en Vercel (ver `.env.example`) y **redeployar**: las variables nuevas no
entran en un deploy ya hecho.

### 5. Chequear

```bash
curl https://loreado.vercel.app/api/stripe
```

Dice qué falta, en qué modo está (test o live) y si los pases pueden viajar
entre dispositivos. Nunca devuelve claves.

## Probar antes de cobrar de verdad

Con la clave de test, tarjeta `4242 4242 4242 4242`, cualquier fecha futura y
cualquier CVC.

Para que los webhooks lleguen a la máquina local:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# usá el whsec_ que imprime, no el del dashboard
```

Vale la pena probar los tres caminos que no son el feliz:

1. **Cerrar la pestaña apenas paga** → el webhook emite el pase igual; entrando
   con Google con ese email, aparece.
2. **Tocar "Atrás" en Checkout** → vuelve a `/app?pago=cancelado` con un aviso
   que no parece un error.
3. **Renovación**: `stripe trigger invoice.paid` → se emite un pase nuevo con la
   fecha nueva.

## Los endpoints

| Ruta | Qué hace | Quién puede |
|---|---|---|
| `POST /api/stripe/checkout` | Abre el pago con tarjeta | mismo origen |
| `GET /api/stripe/return` | Confirma el cobro y entra con el pase puesto | Stripe redirige acá |
| `POST /api/stripe/webhook` | Emite el pase de cada cobro | Stripe (firma) |
| `POST /api/stripe/portal` | Portal: baja, tarjeta, facturas | requiere Google |
| `POST /api/stripe/invoice` | Emite y manda una factura | `STRIPE_ADMIN_SECRET` |
| `GET /api/stripe` | Diagnóstico del deploy | público (sin secretos) |

## Facturar a una empresa

La venta B2B en la región no entra por tarjeta: la empresa pide factura, la
pasa por administración y transfiere a los 15 días.

```bash
node scripts/facturar.mjs rrhh@empresa.com year 20 --usd 69 --nombre "Acme SA"
```

Stripe manda el email con el link de pago, los recordatorios y el recibo.
Cuando se paga, `invoice.paid` emite el pase solo.

## Cómo le llega el pase a quien pagó

Tres caminos, y hacen falta los tres:

1. **Al toque** — Checkout vuelve por `/api/stripe/return`, que verifica el
   cobro contra la API y redirige a `/app?pase=…`. Es el camino normal.
2. **Si cerró la pestaña** — el webhook lo emite igual y lo deja anotado por
   email (hasheado, en Upstash).
3. **En las renovaciones** — entrar con Google con el email del pago. `/api/auth`
   busca primero por cuenta y después por email, y ahí lo entrega.

> El camino 3 depende de Upstash. Sin `KV_REST_API_URL` el cobro funciona y el
> primer pase llega, pero las renovaciones no se entregan solas.

## Al pasar a producción

1. `node scripts/stripe-setup.mjs sk_live_...` — los IDs de precio de test **no
   sirven** en live.
2. Webhook nuevo en modo live (otro `whsec_`).
3. Guardar el portal, otra vez, en modo live.
4. Cargar las variables live en Vercel y redeployar.
5. `curl .../api/stripe` tiene que decir `"modo": "LIVE"`.

## Lo que quedó afuera a propósito

- **Impuestos.** Stripe Tax se activa con un campo (`automatic_tax`), pero
  registrarse a cobrar IVA en cada país es una decisión contable, no técnica.
- **Precios en moneda local.** Los pases están en USD. Cobrar en ARS/MXN/COP
  sube la conversión, y se hace con *multi-currency prices* sobre el mismo
  producto — sin tocar el código de acá, solo agregando IDs.
- **Emails propios.** Los recibos y avisos de cobro los manda Stripe. Un email
  con el link del pase en cada renovación necesitaría un proveedor de mail, que
  el proyecto todavía no tiene.

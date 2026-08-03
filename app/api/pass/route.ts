import { rateLimit, sameOriginStrict } from "../../lib/ratelimit";
import { fmtPassExpiry, normalizePassInput, verifyPass } from "../../lib/pass";
import { sesionDeRequest } from "../../lib/session";
import { reclamar } from "../../lib/passStore";
import * as kv from "../../lib/kv";

export const runtime = "edge";
/**
 * Nunca cacheado. Es un endpoint de diagnóstico y de canje: si el navegador o
 * el CDN guardan la respuesta, se termina mirando el estado de un deploy viejo
 * y creyendo que el actual está roto. (Pasó.)
 */
export const dynamic = "force-dynamic";

const SIN_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  // Response.json() no declara charset, así que el navegador muestra los
  // acentos rotos al abrir esto a mano ("ComparÃ¡"). Con fetch no cambia nada
  // —ahí siempre se decodifica UTF-8—, pero este endpoint se mira a ojo.
  "Content-Type": "application/json; charset=utf-8",
} as const;

// Diagnóstico: ¿este deploy tiene PASS_SECRET cargado?
//
// En Vercel una variable de entorno nueva NO entra en los deploys que ya
// estaban corriendo: hay que redeployar. Sin esto, un pase que no activa se ve
// igual que uno inválido y no hay forma de saber cuál de los dos es. Devuelve
// solo un booleano, nunca el secreto.
export async function GET() {
  const secret = process.env.PASS_SECRET;
  if (!secret) {
    return Response.json(
      {
        pasesConfigurados: false,
        ayuda:
          "Falta PASS_SECRET en este deploy. Cargala en Vercel y REDEPLOYÁ: las variables nuevas no entran en un deploy ya hecho.",
      },
      { headers: SIN_CACHE }
    );
  }
  return Response.json(
    {
      pasesConfigurados: true,
      // Huella del secreto: los primeros 8 hex de su SHA-256. Sirve para
      // comparar si el secreto de Vercel es el mismo con el que se firmaron los
      // pases, sin exponerlo. Un hash truncado de un secreto aleatorio de 256
      // bits no se puede revertir.
      huella: await secretFingerprint(secret),
      // El error de pegado más común: un espacio o un salto de línea que se
      // cuela al copiar y rompe TODAS las firmas en silencio.
      sinEspaciosAlrededor: secret === secret.trim(),
      // ¿Los pases siguen a la cuenta entre dispositivos? Necesita Upstash.
      // Sin esto no se rompe nada, pero cada pase queda atado a su navegador.
      pasesEntreDispositivos: kv.disponible(),
      avisoAlmacenamiento: kv.motivoNoDisponible() || undefined,
      ayuda:
        "Compará 'huella' con la del secreto que firmó tus pases. Si no coinciden, el valor en Vercel es otro.",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "desconocido",
    },
    { headers: SIN_CACHE }
  );
}

async function secretFingerprint(secret: string): Promise<string> {
  const d = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret))
  );
  let out = "";
  for (let i = 0; i < 4; i++) out += d[i].toString(16).padStart(2, "0");
  return out;
}

// Canje y revalidación de un pase. El navegador no puede verificar la firma
// (no tiene el secreto), así que pregunta acá: al pegar el código y después
// cada vez que abre la app, para que un pase vencido deje de valer solo.
export async function POST(req: Request) {
  if (!sameOriginStrict(req)) {
    return Response.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  }
  // La app revalida 1 vez al cargar; 20/min deja lugar a recargas y corta el
  // barrido de códigos a fuerza bruta.
  const rl = rateLimit(req, "pass", 20, 60_000);
  if (!rl.ok) {
    return Response.json(
      { ok: false, error: "Demasiados intentos. Esperá un momento." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const secret = process.env.PASS_SECRET;
  if (!secret) {
    // Sin secreto configurado no se puede validar nada. Es un error de
    // deploy, no de la persona, y se dice así.
    return Response.json(
      { ok: false, error: "Los pases no están configurados en el servidor." },
      { status: 500 }
    );
  }

  let token = "";
  try {
    const body = await req.json();
    // Se normaliza también acá, no solo en el cliente: es el contrato del
    // endpoint y así el arreglo vale venga de donde venga el pedido.
    token = normalizePassInput(String(body?.token || ""));
  } catch {
    return Response.json({ ok: false, error: "Body inválido." }, { status: 400 });
  }
  if (!token || token.length > 500) {
    return Response.json({ ok: false, error: "Pase inválido." }, { status: 400 });
  }

  const r = await verifyPass(token, secret);
  if (r.ok) {
    // Si quien canjea entró con Google, el pase queda atado a esa cuenta: a
    // partir de acá le sigue a cualquier dispositivo donde entre, y deja de
    // servirle a quien reenvíe el código.
    //
    // Sin sesión no se ata nada y todo funciona como siempre. Es deliberado:
    // el login es opcional, y quien ya tenía su pase andando no se puede
    // quedar afuera por un cambio que no pidió.
    const sesion = await sesionDeRequest(req);
    if (sesion) {
      const rec = await reclamar(sesion.sub, token, r.claims.expiresAt);
      if (!rec.ok) {
        return Response.json(
          { ok: false, error: rec.motivo, reason: "claimed" },
          { status: 403, headers: SIN_CACHE }
        );
      }
    }
    return Response.json({
      ok: true,
      email: r.claims.email,
      expiresAt: r.claims.expiresAt,
      plan: r.claims.plan,
      // Para que la UI pueda decir "te va a seguir en tus otros dispositivos".
      atadoACuenta: Boolean(sesion),
    });
  }

  // Mensajes distintos por causa: "venció" y "está mal escrito" se resuelven
  // de maneras muy distintas y la persona ya pagó, así que merece saber cuál es.
  const error =
    r.reason === "expired"
      ? `Tu pase venció el ${fmtPassExpiry(r.expiredAt || 0)}. Escribime y lo renovamos.`
      : "Ese pase no es válido. Revisá que lo hayas copiado entero.";
  return Response.json({ ok: false, error, reason: r.reason }, { status: 400 });
}

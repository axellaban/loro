export const runtime = "edge";
// Diagnóstico: nunca cacheado, o se termina mirando el consumo de ayer.
export const dynamic = "force-dynamic";

/**
 * Cuánto se gastó y cuánto queda. Es lo que lee el panel de /uso.
 *
 * Dos fuentes, porque el consumo no se mide igual en todos lados:
 *
 *  - Los MODELOS se miden desde adentro: cada respuesta informa sus tokens y
 *    `app/lib/uso.ts` los suma a un contador por día en Upstash. Se lee de una,
 *    sin esperar ingesta de analytics: eso es lo que hace que el panel sirva
 *    para mirar mientras pasa.
 *  - DEEPGRAM se pregunta a Deepgram. Se cobra por minuto de audio y el
 *    navegador habla directo con ellos por WebSocket, así que el servidor nunca
 *    ve cuánto duró la sesión. Además es el único de los cuatro proveedores que
 *    expone el SALDO por API: Gemini, OpenAI y Anthropic solo avisan cuando ya
 *    se acabó, con un 429.
 *
 * Por eso "cuánto queda" son dos números distintos: para Deepgram es el saldo
 * real; para los modelos es lo que sobra de PRESUPUESTO_MENSUAL_USD, que es un
 * límite que ponés vos. No hay forma de consultar el saldo de esas tres cuentas.
 *
 * Protegido con USO_TOKEN porque devuelve información de negocio. Sin esa
 * variable no contesta: preferimos que quede apagado antes que abierto por
 * olvido.
 */

import { disponible, motivoNoDisponible, pipeline } from "../../lib/kv";
import { PRECIO_DEEPGRAM_POR_MINUTO } from "../../lib/precios";
import { CLAVE_GASTO, diaLocal } from "../../lib/uso";

const DG = "https://api.deepgram.com/v1";
/** Ventana del reporte. 30 días entra en un solo pipeline sin despeinarse. */
const DIAS = 30;

function autorizado(req: Request): boolean {
  const esperado = (process.env.USO_TOKEN || "").trim();
  if (!esperado) return false;
  const url = new URL(req.url);
  const dado = (req.headers.get("x-uso-token") || url.searchParams.get("token") || "").trim();
  return dado.length > 0 && dado === esperado;
}

async function dg(path: string, apiKey: string): Promise<any> {
  // Con tope: un diagnóstico que se cuelga no diagnostica nada.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${DG}${path}`, {
      headers: { Authorization: `Token ${apiKey}` },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!r.ok) {
      const detalle = (await r.text().catch(() => "")).slice(0, 200);
      throw new Error(`Deepgram devolvió ${r.status}. ${detalle}`);
    }
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function diaMenos(n: number): string {
  return diaLocal(new Date(Date.now() - n * 86_400_000));
}

/** Upstash devuelve los hashes como lista plana [campo, valor, campo, valor…]. */
function aObjeto(plano: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!Array.isArray(plano)) return out;
  for (let i = 0; i + 1 < plano.length; i += 2) {
    const n = Number(plano[i + 1]);
    out[String(plano[i])] = Number.isFinite(n) ? n : 0;
  }
  return out;
}

export type DiaGasto = {
  dia: string;
  usd: number;
  pedidos: number;
  tokensIn: number;
  tokensOut: number;
  sinPrecio: number;
  porProveedor: Record<string, number>;
};

async function gastoDeModelos(): Promise<{ dias: DiaGasto[]; motivo?: string }> {
  if (!disponible()) {
    return { dias: [], motivo: motivoNoDisponible() };
  }
  const claves = Array.from({ length: DIAS }, (_, i) => diaMenos(DIAS - 1 - i));
  const res = await pipeline(claves.map((d) => ["HGETALL", CLAVE_GASTO(d)]));
  if (!res) {
    return { dias: [], motivo: "No se pudo leer el contador de gasto en Upstash (ver logs)." };
  }
  const dias = claves.map((dia, i) => {
    const h = aObjeto(res[i]);
    const porProveedor: Record<string, number> = {};
    for (const [campo, valor] of Object.entries(h)) {
      if (campo.startsWith("usd:")) porProveedor[campo.slice(4)] = valor;
    }
    return {
      dia,
      usd: h.usd || 0,
      pedidos: h.req || 0,
      tokensIn: h.in || 0,
      tokensOut: h.out || 0,
      sinPrecio: h.sin_precio || 0,
      porProveedor,
    };
  });
  return { dias };
}

async function deepgram(): Promise<any> {
  const rawKey = process.env.DEEPGRAM_API_KEY;
  if (!rawKey) return { disponible: false, motivo: "Falta DEEPGRAM_API_KEY en este deploy." };
  const apiKey = rawKey.trim().replace(/^["']|["']$/g, "");

  try {
    const proyectos = await dg("/projects", apiKey);
    const proyecto = proyectos?.projects?.[0];
    if (!proyecto?.project_id) {
      return { disponible: false, motivo: "La key de Deepgram no tiene ningún proyecto asociado." };
    }

    const [saldos, consumo] = await Promise.all([
      dg(`/projects/${proyecto.project_id}/balances`, apiKey),
      dg(`/projects/${proyecto.project_id}/usage?start=${diaMenos(DIAS - 1)}&end=${diaMenos(0)}`, apiKey),
    ]);

    // Puede haber varios saldos (compras distintas); importa el total.
    const saldoUSD = (saldos?.balances || []).reduce(
      (t: number, b: any) => t + (typeof b?.amount === "number" ? b.amount : 0),
      0
    );
    const horas = (consumo?.results || []).reduce(
      (t: number, r: any) => t + (typeof r?.total_hours === "number" ? r.total_hours : 0),
      0
    );
    const pedidos = (consumo?.results || []).reduce(
      (t: number, r: any) => t + (typeof r?.requests === "number" ? r.requests : 0),
      0
    );
    const gastadoUSD = horas * 60 * PRECIO_DEEPGRAM_POR_MINUTO;

    return {
      disponible: true,
      proyecto: proyecto.name || proyecto.project_id,
      saldoUSD: Number(saldoUSD.toFixed(2)),
      minutos: Math.round(horas * 60),
      pedidos,
      // Estimado con el precio de app/lib/precios.ts, no es la factura.
      gastadoUSD: Number(gastadoUSD.toFixed(2)),
      // A este ritmo, cuántos días de crédito quedan.
      diasRestantes: gastadoUSD > 0 ? Math.round((saldoUSD / (gastadoUSD / DIAS)) * 10) / 10 : null,
    };
  } catch (err: any) {
    console.error("[uso] Deepgram:", err?.message || err);
    return { disponible: false, motivo: String(err?.message || err) };
  }
}

export async function GET(req: Request) {
  const sinCache = { "Cache-Control": "no-store" };

  if (!process.env.USO_TOKEN) {
    return Response.json(
      {
        ok: false,
        motivo:
          "Falta USO_TOKEN en este deploy. Generá uno (openssl rand -hex 16), cargalo en Vercel y REDEPLOYÁ: las variables nuevas no entran en un deploy ya hecho.",
      },
      { status: 503, headers: sinCache }
    );
  }
  if (!autorizado(req)) {
    return Response.json({ ok: false, motivo: "Token inválido." }, { status: 401, headers: sinCache });
  }

  // Las dos fuentes en paralelo: una tarda lo que tarde Deepgram y la otra lo
  // que tarde Upstash, no la suma.
  const [modelos, dg] = await Promise.all([gastoDeModelos(), deepgram()]);

  const hoyDia = diaLocal();
  const mesActual = hoyDia.slice(0, 7);
  const suma = (ds: DiaGasto[], campo: (d: DiaGasto) => number) => ds.reduce((t, d) => t + campo(d), 0);

  const hoy = modelos.dias.find((d) => d.dia === hoyDia);
  const delMes = modelos.dias.filter((d) => d.dia.startsWith(mesActual));
  const ultimos7 = modelos.dias.slice(-7);

  // Por proveedor en la ventana entera, para ver de dónde sale el gasto.
  const porProveedor: Record<string, number> = {};
  for (const d of modelos.dias) {
    for (const [p, v] of Object.entries(d.porProveedor)) {
      porProveedor[p] = (porProveedor[p] || 0) + v;
    }
  }

  const presupuesto = Number(process.env.PRESUPUESTO_MENSUAL_USD || 0) || null;
  const gastadoMes = suma(delMes, (d) => d.usd);
  // Ritmo del mes: lo gastado dividido los días que ya pasaron.
  const diaDelMes = Number(hoyDia.slice(8, 10));
  const porDia = diaDelMes > 0 ? gastadoMes / diaDelMes : 0;

  return Response.json(
    {
      ok: true,
      actualizado: new Date().toISOString(),
      dia: hoyDia,
      modelos: {
        // Cuando no hay Upstash el panel muestra el motivo en vez de ceros
        // que parecerían "no gastaste nada".
        disponible: modelos.dias.length > 0 || !modelos.motivo,
        motivo: modelos.motivo,
        hoyUSD: Number((hoy?.usd || 0).toFixed(4)),
        hoyPedidos: hoy?.pedidos || 0,
        semanaUSD: Number(suma(ultimos7, (d) => d.usd).toFixed(4)),
        mesUSD: Number(gastadoMes.toFixed(4)),
        ventanaUSD: Number(suma(modelos.dias, (d) => d.usd).toFixed(4)),
        // Pedidos de modelos sin precio cargado en precios.ts: mientras esto
        // sea > 0, los totales de arriba están incompletos.
        sinPrecio: suma(modelos.dias, (d) => d.sinPrecio),
        porProveedor,
        // Serie para el gráfico del panel.
        dias: modelos.dias.map((d) => ({ dia: d.dia, usd: Number(d.usd.toFixed(4)), pedidos: d.pedidos })),
      },
      deepgram: dg,
      presupuesto: presupuesto
        ? {
            mensualUSD: presupuesto,
            gastadoUSD: Number(gastadoMes.toFixed(4)),
            restanteUSD: Number((presupuesto - gastadoMes).toFixed(4)),
            usado: Number(((gastadoMes / presupuesto) * 100).toFixed(1)),
            // Proyección a fin de mes al ritmo de lo que va del mes.
            proyeccionUSD: Number((porDia * 30).toFixed(2)),
          }
        : null,
      ventanaDias: DIAS,
    },
    { headers: sinCache }
  );
}

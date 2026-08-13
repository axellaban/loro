export const runtime = "edge";
// Diagnóstico: nunca cacheado, o se termina mirando el consumo de ayer.
export const dynamic = "force-dynamic";

/**
 * Consumo de Deepgram: minutos transcritos y saldo que queda.
 *
 * Por qué existe un endpoint solo para esto: el consumo de los modelos se puede
 * medir desde adentro (cada respuesta informa sus tokens; ver app/lib/uso.ts),
 * pero el de Deepgram no. Se cobra por minuto de audio y el navegador habla
 * directo con Deepgram por WebSocket, así que el servidor nunca ve cuánto duró
 * la sesión. Se podría hacer que el cliente reporte los segundos, pero sería un
 * número que manda el navegador —falsificable y fácil de perder si se cierra la
 * pestaña—, y Deepgram ya lleva la cuenta de verdad. Esto la lee.
 *
 * De paso responde la otra mitad: cuánto crédito queda. Deepgram es el único de
 * los cuatro proveedores que expone el saldo por API (Gemini, OpenAI y
 * Anthropic solo avisan cuando ya se acabó, con un 429).
 *
 * Protegido con USO_TOKEN porque devuelve información de negocio (cuánto se
 * gasta y cuánto queda). Sin esa variable el endpoint no contesta: preferimos
 * que quede apagado antes que abierto por olvido.
 */

import { PRECIO_DEEPGRAM_POR_MINUTO } from "../../lib/precios";

const DG = "https://api.deepgram.com/v1";
/** Ventana del reporte de consumo. */
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
      const detalle = (await r.text().catch(() => "")).slice(0, 300);
      throw new Error(`Deepgram devolvió ${r.status} en ${path}. ${detalle}`);
    }
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function fecha(diasAtras: number): string {
  return new Date(Date.now() - diasAtras * 86_400_000).toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const sinCache = { "Cache-Control": "no-store" };

  if (!process.env.USO_TOKEN) {
    return Response.json(
      {
        disponible: false,
        motivo:
          "Falta USO_TOKEN en este deploy. Generá uno (openssl rand -hex 16), cargalo en Vercel y REDEPLOYÁ: las variables nuevas no entran en un deploy ya hecho.",
      },
      { status: 503, headers: sinCache }
    );
  }
  if (!autorizado(req)) {
    return Response.json({ error: "Token inválido." }, { status: 401, headers: sinCache });
  }

  const rawKey = process.env.DEEPGRAM_API_KEY;
  if (!rawKey) {
    return Response.json(
      { disponible: false, motivo: "Falta DEEPGRAM_API_KEY en este deploy." },
      { status: 503, headers: sinCache }
    );
  }
  const apiKey = rawKey.trim().replace(/^["']|["']$/g, "");

  try {
    const proyectos = await dg("/projects", apiKey);
    const proyecto = proyectos?.projects?.[0];
    if (!proyecto?.project_id) {
      return Response.json(
        { disponible: false, motivo: "La key de Deepgram no tiene ningún proyecto asociado." },
        { status: 502, headers: sinCache }
      );
    }

    const [saldos, consumo] = await Promise.all([
      dg(`/projects/${proyecto.project_id}/balances`, apiKey),
      dg(`/projects/${proyecto.project_id}/usage?start=${fecha(DIAS)}&end=${fecha(0)}`, apiKey),
    ]);

    // Deepgram puede tener varios saldos (compras distintas); lo que importa es
    // el total que queda.
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

    return Response.json(
      {
        disponible: true,
        proyecto: proyecto.name || proyecto.project_id,
        saldoUSD: Number(saldoUSD.toFixed(2)),
        ventanaDias: DIAS,
        horas: Number(horas.toFixed(2)),
        minutos: Math.round(horas * 60),
        pedidos,
        // Estimado con el precio de app/lib/precios.ts, no es la factura.
        gastadoUSD: Number(gastadoUSD.toFixed(2)),
        // A este ritmo, cuántos días de crédito quedan.
        diasRestantes:
          gastadoUSD > 0 ? Math.round((saldoUSD / (gastadoUSD / DIAS)) * 10) / 10 : null,
      },
      { headers: sinCache }
    );
  } catch (err: any) {
    console.error("[uso] Deepgram:", err?.message || err);
    return Response.json(
      { disponible: false, motivo: String(err?.message || err) },
      { status: 502, headers: sinCache }
    );
  }
}

"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Panel de consumo. Se mira mientras pasa: refresca solo cada 15 segundos y
 * también cuando volvés a la pestaña.
 *
 * Los estilos van acá adentro y no en globals.css a propósito: esto no es
 * parte del producto, es una herramienta interna de una sola página, y no
 * tiene por qué sumarle peso al CSS que carga todo el mundo.
 *
 * El token no viaja en el HTML: se pide una vez, queda en localStorage de este
 * navegador y se manda por header en cada consulta.
 */

const CLAVE_TOKEN = "loro:uso:token";
const REFRESCO_MS = 15_000;

type Respuesta = any;

function usd(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  if (Math.abs(n) < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

const NOMBRE_PROVEEDOR: Record<string, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  anthropic: "Claude",
  tts: "Voz (TTS)",
};

export default function Panel() {
  const [token, setToken] = useState<string | null>(null);
  const [entrada, setEntrada] = useState("");
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [desde, setDesde] = useState<number>(Date.now());
  const [hace, setHace] = useState(0);

  // El token puede venir en la URL (para pegarlo una sola vez desde el celular)
  // o de una visita anterior.
  useEffect(() => {
    const enUrl = new URLSearchParams(window.location.search).get("token");
    const guardado = localStorage.getItem(CLAVE_TOKEN);
    const t = enUrl || guardado;
    if (enUrl) {
      localStorage.setItem(CLAVE_TOKEN, enUrl);
      // Se saca de la barra de direcciones para que no quede en el historial.
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (t) setToken(t);
  }, []);

  const consultar = useCallback(async (t: string) => {
    setCargando(true);
    try {
      const r = await fetch("/api/uso", { headers: { "x-uso-token": t }, cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setError(j?.motivo || `El servidor respondió ${r.status}.`);
        if (r.status === 401) {
          localStorage.removeItem(CLAVE_TOKEN);
          setToken(null);
        }
        return;
      }
      setDatos(j);
      setError(null);
      setDesde(Date.now());
    } catch (e: any) {
      setError(`No se pudo consultar: ${e?.message || e}`);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    consultar(token);
    const i = setInterval(() => consultar(token), REFRESCO_MS);
    // Volver a la pestaña después de un rato y ver un número viejo es peor que
    // no ver nada: se refresca al enfocar.
    const alVolver = () => {
      if (document.visibilityState === "visible") consultar(token);
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(i);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [token, consultar]);

  // Reloj del "hace Ns", para que se note que el número está vivo.
  useEffect(() => {
    const i = setInterval(() => setHace(Math.round((Date.now() - desde) / 1000)), 1000);
    return () => clearInterval(i);
  }, [desde]);

  if (!token) {
    return (
      <main className="uso">
        <Estilos />
        <h1>Consumo</h1>
        <p className="sub">Pegá el token de acceso (la variable USO_TOKEN del deploy).</p>
        <form
          className="login"
          onSubmit={(e) => {
            e.preventDefault();
            const t = entrada.trim();
            if (!t) return;
            localStorage.setItem(CLAVE_TOKEN, t);
            setToken(t);
          }}
        >
          <input
            type="password"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            placeholder="USO_TOKEN"
            autoFocus
          />
          <button type="submit">Entrar</button>
        </form>
        {error && <p className="error">{error}</p>}
      </main>
    );
  }

  const m = datos?.modelos;
  const dg = datos?.deepgram;
  const pre = datos?.presupuesto;
  const proveedores: [string, number][] = Object.entries(m?.porProveedor || {}) as [string, number][];
  proveedores.sort((a, b) => b[1] - a[1]);
  const maxDia = Math.max(0.0001, ...((m?.dias || []).map((d: any) => d.usd) as number[]));

  return (
    <main className="uso">
      <Estilos />

      <header className="top">
        <h1>Consumo</h1>
        <span className={`vivo ${cargando ? "cargando" : ""}`} />
        <span className="hace mono">
          {datos ? `hace ${hace}s` : "conectando…"}
        </span>
        <button className="refrescar" onClick={() => consultar(token)} disabled={cargando}>
          Refrescar
        </button>
      </header>

      {error && <p className="error">{error}</p>}
      {m && m.disponible === false && (
        <p className="aviso">
          No hay contador de gasto: {m.motivo} Los modelos se siguen midiendo en los logs de Vercel,
          pero este panel no puede sumarlos.
        </p>
      )}
      {m?.sinPrecio > 0 && (
        <p className="aviso">
          {m.sinPrecio} pedido{m.sinPrecio === 1 ? "" : "s"} de un modelo sin precio cargado en{" "}
          <code>app/lib/precios.ts</code>: los totales de abajo están incompletos.
        </p>
      )}

      <section className="tarjetas">
        <div className="tarjeta">
          <span className="label mono">Modelos · hoy</span>
          <strong className="numero">{usd(m?.hoyUSD)}</strong>
          <span className="pie">{m?.hoyPedidos ?? 0} pedidos</span>
        </div>
        <div className="tarjeta">
          <span className="label mono">Modelos · este mes</span>
          <strong className="numero">{usd(m?.mesUSD)}</strong>
          <span className="pie">últimos 7 días: {usd(m?.semanaUSD)}</span>
        </div>
        <div className="tarjeta">
          <span className="label mono">Deepgram · saldo</span>
          <strong className={`numero ${dg?.disponible && dg.saldoUSD < 10 ? "rojo" : ""}`}>
            {dg?.disponible ? usd(dg.saldoUSD) : "—"}
          </strong>
          <span className="pie">
            {dg?.disponible
              ? dg.diasRestantes !== null
                ? `~${dg.diasRestantes} días a este ritmo`
                : "sin consumo en la ventana"
              : dg?.motivo || "no disponible"}
          </span>
        </div>
        <div className="tarjeta">
          <span className="label mono">Deepgram · {datos?.ventanaDias ?? 30} días</span>
          <strong className="numero">{dg?.disponible ? usd(dg.gastadoUSD) : "—"}</strong>
          <span className="pie">{dg?.disponible ? `${dg.minutos} minutos de audio` : "—"}</span>
        </div>
      </section>

      {pre ? (
        <section className="bloque">
          <h2>Presupuesto del mes</h2>
          <div className="barra">
            <div
              className={`relleno ${pre.usado > 90 ? "rojo" : pre.usado > 70 ? "ambar" : ""}`}
              style={{ width: `${Math.min(100, pre.usado)}%` }}
            />
          </div>
          <p className="detalle">
            <strong>{usd(pre.gastadoUSD)}</strong> de {usd(pre.mensualUSD)} ({pre.usado}%) · quedan{" "}
            <strong>{usd(pre.restanteUSD)}</strong> · proyección a fin de mes {usd(pre.proyeccionUSD)}
          </p>
        </section>
      ) : (
        <p className="aviso">
          Sin <code>PRESUPUESTO_MENSUAL_USD</code> cargado no hay contra qué comparar el gasto de los
          modelos: Gemini, OpenAI y Anthropic no exponen el saldo de la cuenta por API, así que el
          "cuánto queda" de esos tres lo tenés que definir vos.
        </p>
      )}

      {proveedores.length > 0 && (
        <section className="bloque">
          <h2>Por proveedor · {datos?.ventanaDias ?? 30} días</h2>
          <ul className="proveedores">
            {proveedores.map(([p, v]) => (
              <li key={p}>
                <span>{NOMBRE_PROVEEDOR[p] || p}</span>
                <span className="mono">{usd(v)}</span>
              </li>
            ))}
            {dg?.disponible && (
              <li className="externo">
                <span>Deepgram</span>
                <span className="mono">{usd(dg.gastadoUSD)}</span>
              </li>
            )}
          </ul>
        </section>
      )}

      {m?.dias?.length > 0 && (
        <section className="bloque">
          <h2>Día a día</h2>
          <div className="grafico">
            {m.dias.map((d: any) => (
              <div key={d.dia} className="col" title={`${d.dia}: ${usd(d.usd)} · ${d.pedidos} pedidos`}>
                <div className="pilar" style={{ height: `${Math.max(2, (d.usd / maxDia) * 100)}%` }} />
              </div>
            ))}
          </div>
          <p className="detalle mono">
            {m.dias[0]?.dia} → {m.dias[m.dias.length - 1]?.dia} · pico {usd(maxDia)}
          </p>
        </section>
      )}

      <p className="nota">
        Los modelos se miden desde adentro (tokens de cada respuesta, precios de{" "}
        <code>app/lib/precios.ts</code>) y son una estimación, no la factura. El saldo de Deepgram sí
        es el real, consultado a Deepgram.
      </p>
    </main>
  );
}

function Estilos() {
  return (
    <style>{`
      .uso { max-width: 720px; margin: 0 auto; padding: 24px 16px 64px; }
      .uso h1 { font-size: 20px; font-weight: 700; }
      .uso h2 { font-size: 12px; font-weight: 600; text-transform: uppercase;
                letter-spacing: .06em; color: var(--ink-dim); margin-bottom: 10px; }
      .uso .sub { color: var(--ink-dim); font-size: 14px; margin: 8px 0 16px; }
      .top { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
      .vivo { width: 8px; height: 8px; border-radius: 50%; background: var(--loro-green);
              box-shadow: 0 0 0 3px rgba(16,185,129,.18); }
      .vivo.cargando { animation: lat .8s ease-in-out infinite; }
      @keyframes lat { 50% { opacity: .25; } }
      .hace { font-size: 12px; color: var(--ink-faint); margin-right: auto; }
      .refrescar { border: 1px solid var(--line-strong); background: var(--panel);
                   border-radius: 8px; padding: 6px 12px; font-size: 13px; color: var(--ink); }
      .refrescar:disabled { opacity: .5; }
      .tarjetas { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
      .tarjeta { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
                 padding: 14px; display: flex; flex-direction: column; gap: 4px; }
      .label { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-faint); }
      .numero { font-size: 26px; font-weight: 700; line-height: 1.1; }
      .numero.rojo { color: var(--loro-red-deep); }
      .pie { font-size: 12px; color: var(--ink-dim); }
      .bloque { margin-top: 24px; }
      .barra { height: 10px; background: var(--line); border-radius: 999px; overflow: hidden; }
      .relleno { height: 100%; background: var(--loro-green); transition: width .4s ease; }
      .relleno.ambar { background: #f59e0b; }
      .relleno.rojo { background: var(--loro-red); }
      .detalle { font-size: 13px; color: var(--ink-dim); margin-top: 8px; }
      .proveedores { list-style: none; border: 1px solid var(--line); border-radius: var(--radius);
                     background: var(--panel); overflow: hidden; }
      .proveedores li { display: flex; justify-content: space-between; padding: 11px 14px;
                        font-size: 14px; border-bottom: 1px solid var(--line); }
      .proveedores li:last-child { border-bottom: 0; }
      .proveedores li.externo { color: var(--ink-dim); }
      .grafico { display: flex; align-items: flex-end; gap: 2px; height: 90px;
                 background: var(--panel); border: 1px solid var(--line);
                 border-radius: var(--radius); padding: 8px; }
      .col { flex: 1; height: 100%; display: flex; align-items: flex-end; }
      .pilar { width: 100%; background: var(--loro-green); border-radius: 2px 2px 0 0; }
      .aviso { margin-top: 16px; padding: 10px 12px; border-radius: 10px; font-size: 13px;
               background: #fff8e6; border: 1px solid #f0d9a0; color: #6b4d09; }
      .error { margin-top: 16px; padding: 10px 12px; border-radius: 10px; font-size: 13px;
               background: #fdecec; border: 1px solid #f3b9b9; color: var(--loro-red-deep); }
      .nota { margin-top: 28px; font-size: 12px; color: var(--ink-faint); line-height: 1.5; }
      .uso code { font-family: "JetBrains Mono", monospace; font-size: .92em; }
      .login { display: flex; gap: 8px; }
      .login input { flex: 1; padding: 10px 12px; border: 1px solid var(--line-strong);
                     border-radius: 8px; font-size: 15px; background: var(--panel); color: var(--ink); }
      .login button { padding: 10px 16px; border: 0; border-radius: 8px;
                      background: var(--btn-dark); color: #fff; font-size: 15px; font-weight: 600; }
      @media (max-width: 420px) { .tarjetas { grid-template-columns: 1fr; } }
    `}</style>
  );
}

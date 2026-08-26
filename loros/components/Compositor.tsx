"use client";

// Escribir y soltar el ave.
//
// La pantalla clave del producto. Lo importante no es el campo de texto: es que
// cada ave muestre, ANTES de mandar, cuánto va a tardar hasta esa persona en
// particular. Ahí es donde elegir ave deja de ser cosmética —"mando el perico
// porque llega en 2 minutos" o "mando el guacamayo justamente porque tarda un
// día"— y el mensaje empieza a decir algo por sí solo.

import { useState } from "react";
import { AVES, AVES_LISTA, type AveId } from "../lib/aves";
import { formatearDistancia, formatearDuracion } from "../lib/geo";
import { duracionVuelo } from "../lib/vuelo";
import { pedir } from "../lib/cliente";
import type { NidoVista } from "../lib/vista";
import { Ave } from "./Ave";

export function Compositor({
  yo,
  amigos,
  escala,
  destinoInicial,
  textoInicial,
  aveInicial,
  alCerrar,
  alEnviado,
}: {
  yo: NidoVista;
  amigos: NidoVista[];
  escala: number;
  destinoInicial?: string | null;
  /** Precargados al volver a mandar un loro que se perdió. */
  textoInicial?: string;
  aveInicial?: AveId;
  alCerrar: () => void;
  alEnviado: (mensaje: string) => void;
}) {
  const [paraId, setParaId] = useState<string>(
    destinoInicial || amigos[0]?.id || ""
  );
  const [ave, setAve] = useState<AveId>(aveInicial ?? yo.ave);
  const [texto, setTexto] = useState(textoInicial ?? "");
  const [turbo, setTurbo] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const para = amigos.find((a) => a.id === paraId) || null;
  // La distancia la manda el servidor: las coordenadas que llegan del otro
  // están corridas a propósito y no sirven para medir (lib/privacidad.ts).
  const km = para?.distanciaKm ?? 0;

  const a = AVES[ave];
  const sobra = a.maxCaracteres - texto.length;
  const duracion = duracionVuelo(km, ave, turbo, escala);

  async function soltar() {
    if (!para || !texto.trim()) return;
    setEnviando(true);
    setError("");
    try {
      await pedir("/api/loros", {
        datos: { para: para.id, ave, texto: texto.trim(), turbo },
      });
      alEnviado(
        `${a.articulo === "la" ? "Tu cotorra salió" : `Tu ${a.nombre.toLowerCase()} despegó`} hacia ${
          para.nombre
        }. Aterriza en ${formatearDuracion(duracion)}.`
      );
    } catch (e: any) {
      setError(e?.message || "No se pudo soltar el ave.");
      setEnviando(false);
    }
  }

  return (
    <div
      onClick={alCerrar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 900,
        background: "rgba(3, 8, 7, 0.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        animation: "aparecer .18s ease both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="tarjeta entra scroll"
        style={{
          width: "min(560px, 100%)",
          maxHeight: "92dvh",
          borderRadius: "20px 20px 0 0",
          padding: "18px 18px calc(18px + env(safe-area-inset-bottom))",
          background: "rgba(10, 21, 20, 0.96)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 19, flex: 1 }}>Soltar un loro</h2>
          <button
            onClick={alCerrar}
            aria-label="Cerrar"
            style={{
              background: "var(--panel-alto)",
              border: "1px solid var(--borde)",
              width: 32,
              height: 32,
              borderRadius: 99,
              cursor: "pointer",
              fontSize: 15,
            }}
          >
            ✕
          </button>
        </div>

        {amigos.length === 0 ? (
          <p style={{ color: "var(--suave)", fontSize: 14.5, lineHeight: 1.6 }}>
            Todavía no tenés a nadie en la bandada. Compartí tu código de nido y
            volvé cuando alguien te agregue.
          </p>
        ) : (
          <>
            <p className="etiqueta">Para</p>
            <div
              className="scroll"
              style={{ display: "flex", gap: 8, overflowX: "auto", padding: "8px 0 12px" }}
            >
              {amigos.map((f) => {
                const activo = f.id === paraId;
                return (
                  <button
                    key={f.id}
                    onClick={() => setParaId(f.id)}
                    style={{
                      flexShrink: 0,
                      padding: "8px 14px",
                      borderRadius: 999,
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 650,
                      background: activo ? "var(--esmeralda)" : "var(--panel)",
                      color: activo ? "#04120e" : "var(--texto)",
                      border: `1px solid ${activo ? "var(--esmeralda)" : "var(--borde)"}`,
                    }}
                  >
                    {f.bot ? "🪺 " : ""}
                    {f.nombre}
                  </button>
                );
              })}
            </div>

            {para && (
              <p style={{ color: "var(--suave)", fontSize: 13.5, marginBottom: 14 }}>
                {para.nombre} está a{" "}
                <strong style={{ color: "var(--texto)" }}>{formatearDistancia(km)}</strong>
                {para.lugar ? ` · ${para.lugar}` : ""}
              </p>
            )}

            <p className="etiqueta">Con qué ave</p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 8,
                margin: "8px 0 16px",
              }}
            >
              {AVES_LISTA.map((x) => {
                const activa = x.id === ave;
                const eta = formatearDuracion(duracionVuelo(km, x.id, turbo, escala));
                return (
                  <button
                    key={x.id}
                    onClick={() => setAve(x.id)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 2,
                      padding: "10px 12px",
                      borderRadius: 12,
                      cursor: "pointer",
                      textAlign: "left",
                      background: activa ? `${x.color}22` : "var(--panel)",
                      border: `1px solid ${activa ? x.color : "var(--borde)"}`,
                      transition: "all .14s ease",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Ave especie={x.id} size={24} aletea={activa} />
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{x.nombre}</span>
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 800, color: x.color }}>{eta}</span>
                    <span style={{ fontSize: 11.5, color: "var(--tenue)" }}>
                      {x.velocidadKmh} km/h · {x.maxCaracteres} car.
                    </span>
                  </button>
                );
              })}
            </div>

            <textarea
              className="campo"
              rows={4}
              maxLength={a.maxCaracteres}
              placeholder={`Lo que le va a repetir ${a.articulo} ${a.nombre.toLowerCase()}…`}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                margin: "8px 2px 16px",
                fontSize: 12.5,
              }}
            >
              <span style={{ color: sobra < 20 ? a.color : "var(--tenue)", flex: 1 }}>
                {sobra} caracteres para {a.articulo === "la" ? "la" : "el"}{" "}
                {a.nombre.toLowerCase()}
              </span>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "var(--suave)",
                  cursor: "pointer",
                  userSelect: "none",
                }}
                title="Comprime el viaje a unos minutos, manteniendo las proporciones entre aves. Para mostrar la app sin esperar de verdad."
              >
                <input
                  type="checkbox"
                  checked={turbo}
                  onChange={(e) => setTurbo(e.target.checked)}
                  style={{ accentColor: "var(--esmeralda)" }}
                />
                Vuelo de prueba
              </label>
            </div>

            {error && (
              <p style={{ color: "#fca5a5", fontSize: 13.5, marginBottom: 12 }}>{error}</p>
            )}

            <button
              className="boton"
              style={{ width: "100%", background: a.color }}
              disabled={!texto.trim() || !para || enviando}
              onClick={soltar}
            >
              {enviando
                ? "Despegando…"
                : `Soltar ${a.articulo} ${a.nombre.toLowerCase()} · llega en ${formatearDuracion(duracion)}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

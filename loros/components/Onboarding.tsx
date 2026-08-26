"use client";

// Los tres pasos para tener nido: cómo te llamás, dónde estás, con qué ave
// mandás. El orden no es casual — la ubicación se pide en el paso 2, cuando la
// persona ya entendió para qué la queremos. Pedirla al entrar, sin contexto, es
// la forma más rápida de que le den "bloquear".

import { useState } from "react";
import dynamic from "next/dynamic";
import { AVES_LISTA, type AveId } from "../lib/aves";
import type { Punto } from "../lib/geo";
import { pedir, pedirUbicacion } from "../lib/cliente";
import type { NidoVista } from "../lib/vista";
import { Ave } from "./Ave";

const Mapa = dynamic(() => import("./Mapa"), { ssr: false });

export function Onboarding({
  alTerminar,
}: {
  alTerminar: (yo: NidoVista, codigo: string) => void;
}) {
  const [paso, setPaso] = useState(1);
  const [nombre, setNombre] = useState("");
  const [punto, setPunto] = useState<Punto | null>(null);
  const [ave, setAve] = useState<AveId>("loro");
  const [aMano, setAMano] = useState(false);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function ubicar() {
    setOcupado(true);
    setError("");
    const r = await pedirUbicacion();
    setOcupado(false);
    if (r.ok) {
      setPunto(r.punto);
      setPaso(3);
    } else {
      setError(r.motivo);
      setAMano(true);
    }
  }

  async function crear() {
    if (!punto) return;
    setOcupado(true);
    setError("");
    try {
      const r = await pedir<{ yo: NidoVista; codigo: string }>("/api/nido", {
        datos: { nombre: nombre.trim(), ave, lat: punto.lat, lng: punto.lng },
      });
      // El nido ya vino en la respuesta: se lo pasamos entero al padre en vez
      // de salir a buscarlo de nuevo.
      alTerminar(r.yo, r.codigo || "");
    } catch (e: any) {
      setError(e?.message || "No se pudo crear el nido.");
    } finally {
      // Siempre, no solo cuando falla. Estaba solo en el catch, así que en el
      // camino de éxito el botón se quedaba en "Armando el nido…" para siempre
      // si por lo que fuera la app no llegaba a cambiar de pantalla.
      setOcupado(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "24px 18px 40px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <Ave especie={ave} size={62} aletea />
          </div>
          <h1 style={{ fontSize: 27, fontWeight: 800 }}>Armá tu nido</h1>
          <p style={{ color: "var(--suave)", marginTop: 8, fontSize: 15 }}>
            Tres pasos y tenés tu primera ave lista para despegar.
          </p>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 18 }}>
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                style={{
                  width: paso === n ? 26 : 8,
                  height: 8,
                  borderRadius: 99,
                  background: paso >= n ? "var(--esmeralda)" : "var(--borde-alto)",
                  transition: "all .25s ease",
                }}
              />
            ))}
          </div>
        </div>

        <div className="tarjeta entra" key={paso} style={{ padding: 22 }}>
          {paso === 1 && (
            <>
              <p className="etiqueta">Paso 1 de 3</p>
              <h2 style={{ fontSize: 21, margin: "10px 0 6px" }}>¿Cómo te anuncia el ave?</h2>
              <p style={{ color: "var(--suave)", fontSize: 14.5, marginBottom: 16 }}>
                Es el nombre que ve quien recibe tus loros.
              </p>
              <input
                className="campo"
                autoFocus
                maxLength={24}
                placeholder="Tu nombre o apodo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && nombre.trim()) setPaso(2);
                }}
              />
              <button
                className="boton"
                style={{ width: "100%", marginTop: 16 }}
                disabled={!nombre.trim()}
                onClick={() => setPaso(2)}
              >
                Seguir
              </button>
            </>
          )}

          {paso === 2 && (
            <>
              <p className="etiqueta">Paso 2 de 3</p>
              <h2 style={{ fontSize: 21, margin: "10px 0 6px" }}>¿Desde dónde despega?</h2>
              <p style={{ color: "var(--suave)", fontSize: 14.5, marginBottom: 14 }}>
                Acá está todo el asunto: tu ave sale de donde estás y tarda lo que
                tarda hasta el otro. Sin ubicación no hay vuelo, solo chat.
              </p>
              {/* Este párrafo va acá y no en una política que nadie lee: es el
                  segundo exacto en que la persona decide dar el permiso. */}
              <div
                style={{
                  padding: "11px 13px",
                  borderRadius: 10,
                  background: "rgba(16,185,129,.08)",
                  border: "1px solid rgba(16,185,129,.24)",
                  marginBottom: 16,
                }}
              >
                <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--suave)" }}>
                  🔒 <strong style={{ color: "var(--texto)" }}>Nadie ve dónde vivís.</strong>{" "}
                  Tus coordenadas se usan para calcular la distancia y no salen de
                  acá: los demás ven una zona de 3 km y el nombre de tu ciudad,
                  nunca tu calle. El tiempo de vuelo sí es exacto.
                </p>
              </div>

              {!aMano ? (
                <>
                  <button
                    className="boton"
                    style={{ width: "100%" }}
                    onClick={ubicar}
                    disabled={ocupado}
                  >
                    {ocupado ? "Buscando…" : "📍 Usar mi ubicación"}
                  </button>
                  <button
                    className="boton fantasma chico"
                    style={{ width: "100%", marginTop: 10 }}
                    onClick={() => setAMano(true)}
                  >
                    Prefiero marcarlo a mano
                  </button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 14, color: "var(--suave)", marginBottom: 10 }}>
                    Tocá el mapa donde queda tu nido.
                  </p>
                  <div
                    style={{
                      position: "relative",
                      height: 260,
                      borderRadius: 12,
                      overflow: "hidden",
                      border: "1px solid var(--borde)",
                    }}
                  >
                    <Mapa
                      yo={
                        punto
                          ? {
                              id: "yo",
                              nombre: nombre || "Tu nido",
                              lugar: "",
                              lat: punto.lat,
                              lng: punto.lng,
                              bot: false,
                              ave,
                              radioKm: 0,
                            }
                          : null
                      }
                      amigos={[]}
                      vuelos={[]}
                      ahoraServidor={Date.now}
                      modoElegir
                      alElegirPunto={setPunto}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button className="boton fantasma" onClick={ubicar} disabled={ocupado}>
                      Reintentar GPS
                    </button>
                    <button
                      className="boton"
                      style={{ flex: 1 }}
                      disabled={!punto}
                      onClick={() => setPaso(3)}
                    >
                      {punto ? "Este es mi nido" : "Marcá un punto"}
                    </button>
                  </div>
                </>
              )}
              {error && (
                <p style={{ color: "#fca5a5", fontSize: 13.5, marginTop: 12, lineHeight: 1.5 }}>
                  {error}
                </p>
              )}
            </>
          )}

          {paso === 3 && (
            <>
              <p className="etiqueta">Paso 3 de 3</p>
              <h2 style={{ fontSize: 21, margin: "10px 0 6px" }}>Elegí tu ave</h2>
              <p style={{ color: "var(--suave)", fontSize: 14.5, marginBottom: 16 }}>
                Cuanto más rápido vuela, menos le entra en la cabeza. Podés cambiar
                de ave en cada mensaje.
              </p>

              <div style={{ display: "grid", gap: 10 }}>
                {AVES_LISTA.map((a) => {
                  const elegida = ave === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setAve(a.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "12px 14px",
                        borderRadius: 12,
                        cursor: "pointer",
                        textAlign: "left",
                        background: elegida ? `${a.color}2b` : "var(--panel)",
                        border: `1px solid ${elegida ? a.color : "var(--borde)"}`,
                        // Anillo además del borde: con un 1px de color sobre
                        // fondo casi negro no se distingue cuál está elegida.
                        boxShadow: elegida ? `0 0 0 1px ${a.color}, 0 0 22px -8px ${a.color}` : "none",
                        transition: "all .15s ease",
                      }}
                    >
                      <Ave especie={a.id} size={40} aletea={elegida} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 700, fontSize: 15.5 }}>
                          {a.nombre}
                        </span>
                        <span style={{ display: "block", color: "var(--suave)", fontSize: 13 }}>
                          {a.velocidadKmh} km/h · hasta {a.maxCaracteres} caracteres
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: a.color,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {a.lema}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                className="boton"
                style={{ width: "100%", marginTop: 18 }}
                onClick={crear}
                disabled={ocupado}
              >
                {ocupado ? "Armando el nido…" : "Entrar al mapa"}
              </button>
              {error && (
                <p style={{ color: "#fca5a5", fontSize: 13.5, marginTop: 12 }}>{error}</p>
              )}
              <p style={{ color: "var(--tenue)", fontSize: 12.5, marginTop: 14, lineHeight: 1.6 }}>
                Sin registro ni contraseña: tu nido queda guardado en este
                navegador. Después podés llevártelo a otro dispositivo con la
                llave que está en el panel.
              </p>
            </>
          )}
        </div>

        {paso > 1 && (
          <button
            className="boton fantasma chico"
            style={{ marginTop: 14 }}
            onClick={() => {
              setError("");
              setPaso(paso - 1);
            }}
          >
            ← Volver
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

// El panel de la derecha (o la hoja de abajo, en el celular): lo que está en el
// aire, lo que llegó, y quién está en tu bandada.
//
// La pestaña "En vuelo" es la que hace que la app se sienta viva: barra que
// avanza, contador que baja y kilómetros que faltan, todos calculados con el
// reloj del servidor. No hace falta que llegue nada del backend para que se
// mueva.

import { useState } from "react";
import { AVES } from "../lib/aves";
import {
  cuentaRegresiva,
  formatearDistancia,
  formatearDuracion,
} from "../lib/geo";
import { duracionVuelo } from "../lib/vuelo";
import { pedir, useTic } from "../lib/cliente";
import type { LoroVista, NidoVista } from "../lib/vista";
import { Ave } from "./Ave";

type Props = {
  yo: NidoVista;
  codigo: string;
  amigos: NidoVista[];
  loros: LoroVista[];
  escala: number;
  ahoraServidor: () => number;
  alEnfocar: (id: string) => void;
  alEscribir: (idAmigo?: string) => void;
  alReenviar: (loro: LoroVista) => void;
  refrescar: () => void;
};

export function Panel(p: Props) {
  const [pestaña, setPestaña] = useState<"vuelo" | "buzon" | "bandada">("vuelo");
  const enVuelo = p.loros
    .filter((l) => !l.llego && !l.perdido)
    .sort((a, b) => a.llegada - b.llegada);
  // El buzón guarda lo que terminó, haya terminado bien o mal.
  const llegados = p.loros.filter((l) => l.llego || l.perdido);
  const sinLeer = llegados.filter((l) => l.direccion === "recibido" && !l.leido).length;

  useTic(enVuelo.length > 0);

  const pestañas = [
    { id: "vuelo" as const, texto: "En vuelo", contador: enVuelo.length },
    { id: "buzon" as const, texto: "Buzón", contador: sinLeer },
    { id: "bandada" as const, texto: "Bandada", contador: 0 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Cabecera yo={p.yo} codigo={p.codigo} />

      <div style={{ display: "flex", gap: 6, padding: "0 14px 12px" }}>
        {pestañas.map((t) => {
          const activa = pestaña === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setPestaña(t.id)}
              style={{
                flex: 1,
                padding: "9px 6px",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 13.5,
                fontWeight: 700,
                background: activa ? "var(--panel-alto)" : "transparent",
                border: `1px solid ${activa ? "var(--borde-alto)" : "transparent"}`,
                color: activa ? "var(--texto)" : "var(--suave)",
              }}
            >
              {t.texto}
              {t.contador > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    padding: "1px 7px",
                    borderRadius: 99,
                    fontSize: 11,
                    background: "var(--esmeralda)",
                    color: "#04120e",
                  }}
                >
                  {t.contador}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: "0 14px 90px" }}>
        {pestaña === "vuelo" && (
          <>
            {enVuelo.length === 0 ? (
              <Vacio
                titulo="No hay nada en el aire"
                texto="Cuando sueltes un ave la vas a ver acá, cruzando el mapa en tiempo real."
              />
            ) : (
              enVuelo.map((l) => (
                <TarjetaVuelo
                  key={l.id}
                  loro={l}
                  ahora={p.ahoraServidor()}
                  alTocar={() => p.alEnfocar(l.id)}
                />
              ))
            )}
          </>
        )}

        {pestaña === "buzon" && (
          <>
            {llegados.length === 0 ? (
              <Vacio
                titulo="Buzón vacío"
                texto="Acá aparecen los loros que ya aterrizaron, tuyos y de los demás."
              />
            ) : (
              llegados.map((l) => (
                <TarjetaBuzon
                  key={l.id}
                  loro={l}
                  refrescar={p.refrescar}
                  alReenviar={p.alReenviar}
                />
              ))
            )}
          </>
        )}

        {pestaña === "bandada" && (
          <Bandada
            amigos={p.amigos}
            escala={p.escala}
            alEscribir={p.alEscribir}
            alEnfocar={p.alEnfocar}
            refrescar={p.refrescar}
          />
        )}
      </div>
    </div>
  );
}

// ---------- cabecera ----------

function Cabecera({ yo, codigo }: { yo: NidoVista; codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  const [llave, setLlave] = useState("");
  const [pidiendoLlave, setPidiendoLlave] = useState(false);

  async function compartir() {
    const texto = `Mandame un loro 🦜 Mi código de nido es ${codigo}`;
    const url = typeof window !== "undefined" ? window.location.origin : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Loros", text: texto, url });
      } else {
        await navigator.clipboard.writeText(`${texto} — ${url}`);
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {}
  }

  async function pedirLlave() {
    setPidiendoLlave(true);
    try {
      const r = await pedir<{ llave: string }>("/api/sesion");
      const url = `${window.location.origin}/entrar?llave=${encodeURIComponent(r.llave)}`;
      setLlave(url);
      await navigator.clipboard.writeText(url).catch(() => {});
    } catch {
      setLlave("no-se-pudo");
    } finally {
      setPidiendoLlave(false);
    }
  }

  return (
    <div style={{ padding: "16px 16px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Ave especie={yo.ave} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 750, fontSize: 15.5 }}>{yo.nombre}</p>
          <p
            style={{
              color: "var(--tenue)",
              fontSize: 12.5,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {yo.lugar || `${yo.lat.toFixed(3)}, ${yo.lng.toFixed(3)}`}
          </p>
        </div>
        <button className="boton fantasma chico" onClick={compartir}>
          {copiado ? "✓ Copiado" : "Compartir"}
        </button>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 12,
          padding: "9px 12px",
          borderRadius: 10,
          background: "var(--panel)",
          border: "1px dashed var(--borde-alto)",
        }}
      >
        <span className="etiqueta">Tu código</span>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: "var(--esmeralda-alto)",
          }}
        >
          {codigo}
        </span>
      </div>

      {/* Sin cuentas, el nido vive en esta cookie. Esto es la única forma de
          llevárselo a otro teléfono — y de no perderlo al limpiar el navegador. */}
      <button
        onClick={pedirLlave}
        disabled={pidiendoLlave}
        style={{
          background: "none",
          border: "none",
          padding: "8px 2px 0",
          cursor: "pointer",
          fontSize: 12,
          color: "var(--tenue)",
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        {llave ? "Llave copiada" : "Abrir mi nido en otro dispositivo"}
      </button>
      {llave === "no-se-pudo" && (
        <p style={{ color: "#fca5a5", fontSize: 12, marginTop: 6 }}>
          No se pudo generar la llave. Probá de nuevo.
        </p>
      )}
      {llave && llave !== "no-se-pudo" && (
        <div
          style={{
            marginTop: 8,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(251,191,36,.08)",
            border: "1px solid rgba(251,191,36,.28)",
          }}
        >
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--suave)" }}>
            Copiamos un link al portapapeles. Abrilo en el otro dispositivo y tu
            nido aparece ahí.{" "}
            <strong style={{ color: "#fbbf24" }}>
              No se lo pases a nadie: ese link ES tu nido
            </strong>
            , no es tu código.
          </p>
          <p
            style={{
              marginTop: 8,
              fontFamily: "var(--mono)",
              fontSize: 10.5,
              color: "var(--tenue)",
              wordBreak: "break-all",
            }}
          >
            {llave}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------- vuelo ----------

function TarjetaVuelo({
  loro,
  ahora,
  alTocar,
}: {
  loro: LoroVista;
  ahora: number;
  alTocar: () => void;
}) {
  const a = AVES[loro.ave];
  const total = Math.max(1, loro.llegada - loro.salida);
  const t = Math.min(1, Math.max(0, (ahora - loro.salida) / total));
  const falta = Math.max(0, loro.llegada - ahora);
  const enviado = loro.direccion === "enviado";

  return (
    <button
      onClick={alTocar}
      className="tarjeta"
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: 14,
        marginBottom: 10,
        cursor: "pointer",
        borderColor: `${a.color}55`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Ave especie={loro.ave} size={30} aletea />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14.5, fontWeight: 700 }}>
            {enviado ? `${a.nombre} → ${loro.otro.nombre}` : `${a.nombre} de ${loro.otro.nombre}`}
          </p>
          <p style={{ color: "var(--tenue)", fontSize: 12 }}>
            {enviado ? "En camino" : "Viene hacia vos"} ·{" "}
            {formatearDistancia(loro.distanciaKm * (1 - t))} por delante
            {loro.turbo ? " · vuelo de prueba" : ""}
          </p>
        </div>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 17,
            fontWeight: 700,
            color: a.color,
          }}
        >
          {cuentaRegresiva(falta)}
        </span>
      </div>

      <div
        style={{
          position: "relative",
          height: 5,
          borderRadius: 99,
          background: "rgba(255,255,255,.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${t * 100}%`,
            background: a.color,
            borderRadius: 99,
            // Sin transición: la posición ya se recalcula sola cada segundo y
            // una animación encima la haría ir a destiempo del mapa.
          }}
        />
      </div>
      <p style={{ color: "var(--tenue)", fontSize: 11.5, marginTop: 7 }}>
        {Math.round(t * 100)}% del camino · {formatearDistancia(loro.distanciaKm)} en total
      </p>
    </button>
  );
}

// ---------- buzón ----------

function TarjetaBuzon({
  loro,
  refrescar,
  alReenviar,
}: {
  loro: LoroVista;
  refrescar: () => void;
  alReenviar: (loro: LoroVista) => void;
}) {
  const [abriendo, setAbriendo] = useState(false);
  const [abierto, setAbierto] = useState(Boolean(loro.leido));
  const a = AVES[loro.ave];
  const enviado = loro.direccion === "enviado";
  const sellado = !enviado && !abierto;

  if (loro.perdido) return <TarjetaPerdido loro={loro} alReenviar={alReenviar} />;

  async function abrir() {
    setAbriendo(true);
    try {
      await pedir("/api/loros/leer", { datos: { id: loro.id } });
      setAbierto(true);
      refrescar();
    } catch {
      // Aunque falle el registro de "leído", el texto ya está de este lado:
      // no tiene sentido esconderlo por un error de red.
      setAbierto(true);
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <div
      className="tarjeta"
      style={{
        padding: 14,
        marginBottom: 10,
        borderColor: sellado ? a.color : "var(--borde)",
        background: sellado ? `${a.color}14` : "var(--panel)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Ave especie={loro.ave} size={26} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700 }}>
            {enviado ? `Para ${loro.otro.nombre}` : `De ${loro.otro.nombre}`}
          </p>
          <p style={{ color: "var(--tenue)", fontSize: 11.5 }}>
            {formatearDistancia(loro.distanciaKm)} ·{" "}
            {formatearDuracion(loro.llegada - loro.salida)} de vuelo · aterrizó{" "}
            {haceCuanto(loro.llegada)}
          </p>
        </div>
      </div>

      {sellado ? (
        <button
          className="boton chico"
          style={{ width: "100%", marginTop: 12, background: a.color }}
          onClick={abrir}
          disabled={abriendo}
        >
          {abriendo ? "Abriendo…" : `Aterrizó ${a.articulo} ${a.nombre.toLowerCase()} — abrir`}
        </button>
      ) : (
        <p
          className="entra"
          style={{
            marginTop: 10,
            fontSize: 14.5,
            lineHeight: 1.6,
            color: enviado ? "var(--suave)" : "var(--texto)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {loro.texto}
        </p>
      )}
    </div>
  );
}

/**
 * El loro que no llegó.
 *
 * Se muestra apagado y con el borde cortado: tiene que leerse distinto de un
 * mensaje entregado incluso de reojo. A quien lo mandó se le devuelve su texto
 * y un botón para volver a intentarlo —perder lo que escribiste sin siquiera
 * poder copiarlo sería ensañamiento—. A quien lo esperaba no se le muestra
 * nada del contenido: ese mensaje no llegó y no va a llegar.
 */
function TarjetaPerdido({
  loro,
  alReenviar,
}: {
  loro: LoroVista;
  alReenviar: (loro: LoroVista) => void;
}) {
  const a = AVES[loro.ave];
  const enviado = loro.direccion === "enviado";

  return (
    <div
      className="tarjeta"
      style={{
        padding: 14,
        marginBottom: 10,
        borderStyle: "dashed",
        borderColor: "rgba(255,255,255,.14)",
        background: "rgba(255,255,255,.02)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ opacity: 0.3, filter: "grayscale(1)", display: "inline-flex" }}>
          <Ave especie={loro.ave} size={26} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--suave)" }}>
            {enviado
              ? `${a.nombre} perdido camino a ${loro.otro.nombre}`
              : `Se perdió un ${a.nombre.toLowerCase()} de ${loro.otro.nombre}`}
          </p>
          <p style={{ color: "var(--tenue)", fontSize: 11.5 }}>
            🍃 No llegó · voló{" "}
            {formatearDistancia(
              loro.distanciaKm *
                Math.min(1, ((loro.extravio ?? 0) - loro.salida) / Math.max(1, loro.llegada - loro.salida))
            )}{" "}
            de {formatearDistancia(loro.distanciaKm)}
          </p>
        </div>
      </div>

      {loro.motivo && (
        <p style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.55, color: "var(--suave)" }}>
          {loro.motivo}
        </p>
      )}

      {enviado ? (
        <>
          <p
            style={{
              marginTop: 10,
              padding: "9px 11px",
              borderRadius: 9,
              background: "rgba(0,0,0,.25)",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "var(--tenue)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {loro.texto}
          </p>
          <button
            className="boton fantasma chico"
            style={{ width: "100%", marginTop: 10 }}
            onClick={() => alReenviar(loro)}
          >
            Volver a mandarlo
          </button>
        </>
      ) : (
        <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--tenue)", fontStyle: "italic" }}>
          Nunca vas a saber qué decía.
        </p>
      )}
    </div>
  );
}

function haceCuanto(ms: number): string {
  const d = Date.now() - ms;
  if (d < 60_000) return "recién";
  return `hace ${formatearDuracion(d)}`;
}

// ---------- bandada ----------

function Bandada({
  amigos,
  escala,
  alEscribir,
  alEnfocar,
  refrescar,
}: {
  amigos: NidoVista[];
  escala: number;
  alEscribir: (id?: string) => void;
  alEnfocar: (id: string) => void;
  refrescar: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function agregar() {
    setOcupado(true);
    setError("");
    setMensaje("");
    try {
      const r = await pedir<{ amigo: NidoVista }>("/api/amigos", {
        datos: { codigo: codigo.trim().toUpperCase() },
      });
      setMensaje(`${r.amigo.nombre} entró a tu bandada.`);
      setCodigo("");
      refrescar();
    } catch (e: any) {
      setError(e?.message || "No se pudo agregar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <div className="tarjeta" style={{ padding: 14, marginBottom: 14 }}>
        <p className="etiqueta">Agregar por código</p>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input
            className="campo"
            style={{
              fontFamily: "var(--mono)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
            placeholder="ABC123"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter" && codigo.length === 6) agregar();
            }}
          />
          <button
            className="boton"
            onClick={agregar}
            disabled={codigo.trim().length !== 6 || ocupado}
          >
            Sumar
          </button>
        </div>
        {mensaje && (
          <p style={{ color: "var(--esmeralda-alto)", fontSize: 13, marginTop: 10 }}>{mensaje}</p>
        )}
        {error && <p style={{ color: "#fca5a5", fontSize: 13, marginTop: 10 }}>{error}</p>}
      </div>

      <p
        style={{
          fontSize: 12,
          lineHeight: 1.55,
          color: "var(--tenue)",
          margin: "0 2px 14px",
        }}
      >
        🔒 En el mapa nadie ve tu dirección: de cada nido ajeno se dibuja una
        zona de {amigos.find((f) => f.radioKm > 0)?.radioKm ?? 3} km, no un
        punto. La distancia y el tiempo de vuelo sí son exactos.
      </p>

      {amigos.map((f) => {
        const km = f.distanciaKm ?? 0;
        return (
          <div key={f.id} className="tarjeta" style={{ padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => alEnfocar(f.id)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  flex: 1,
                  minWidth: 0,
                  textAlign: "left",
                }}
              >
                <p style={{ fontSize: 15, fontWeight: 700 }}>
                  {f.bot ? "🪺 " : ""}
                  {f.nombre}
                </p>
                <p style={{ color: "var(--tenue)", fontSize: 12.5 }}>
                  {formatearDistancia(km)}
                  {f.lugar ? ` · ${f.lugar}` : ""}
                </p>
              </button>
              <button className="boton chico" onClick={() => alEscribir(f.id)}>
                Escribirle
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {(["perico", "cotorra", "loro", "guacamayo"] as const).map((id) => (
                <span
                  key={id}
                  className="pastilla"
                  style={{ color: AVES[id].color, borderColor: `${AVES[id].color}44` }}
                >
                  {AVES[id].nombre} {formatearDuracion(duracionVuelo(km, id, false, escala))}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ---------- vacíos ----------

function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div style={{ textAlign: "center", padding: "38px 16px", color: "var(--suave)" }}>
      <div style={{ opacity: 0.35, display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <Ave especie="loro" size={46} />
      </div>
      <p style={{ fontWeight: 700, color: "var(--texto)", marginBottom: 6 }}>{titulo}</p>
      <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>{texto}</p>
    </div>
  );
}

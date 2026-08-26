"use client";

// La app. Mapa a un lado, panel al otro, y el compositor encima cuando toca.
//
// Acá no hay lógica de vuelo: el estado viene de /api/estado y las posiciones
// las calcula el mapa. Lo que sí vive acá es lo que une todo — a quién le
// estamos escribiendo, qué está enfocado en el mapa, y avisar cuando un ave
// aterriza.

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Onboarding } from "../../components/Onboarding";
import { Panel } from "../../components/Panel";
import { Compositor } from "../../components/Compositor";
import { Ave } from "../../components/Ave";
import {
  avisar,
  pedir,
  pedirPermisoAvisos,
  pedirUbicacion,
  useEstado,
} from "../../lib/cliente";
import { distanciaKm } from "../../lib/geo";
import { AVES } from "../../lib/aves";

const Mapa = dynamic(() => import("../../components/Mapa"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
      <p style={{ color: "var(--tenue)", fontSize: 13 }}>Desplegando el mapa…</p>
    </div>
  ),
});

export default function Nido() {
  const est = useEstado();
  const [compositor, setCompositor] = useState<{ abierto: boolean; para?: string | null }>({
    abierto: false,
  });
  // El foco lleva un número pegado atrás para que tocar dos veces el mismo nido
  // vuelva a mover la cámara: si fuera solo el id, React no vería un cambio.
  const [foco, setFoco] = useState<string | null>(null);
  const enfocar = useCallback((id: string) => setFoco(`${id}#${Date.now()}`), []);
  const [aviso, setAviso] = useState("");
  const yaLlegados = useRef<Set<string> | null>(null);

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso((a) => (a === texto ? "" : a)), 5200);
  }, []);

  // Aterrizajes. La primera vuelta solo toma nota de lo que ya estaba: si no,
  // al abrir la app saltarían de golpe todos los avisos viejos.
  useEffect(() => {
    const llegados = est.loros.filter((l) => l.llego && l.direccion === "recibido");
    if (yaLlegados.current === null) {
      yaLlegados.current = new Set(llegados.map((l) => l.id));
      return;
    }
    for (const l of llegados) {
      if (yaLlegados.current.has(l.id)) continue;
      yaLlegados.current.add(l.id);
      const a = AVES[l.ave];
      const texto = `${a.nombre} de ${l.otro.nombre} aterrizó en tu nido.`;
      mostrarAviso(`🪶 ${texto}`);
      avisar("Aterrizó un loro 🦜", texto);
    }
  }, [est.loros, mostrarAviso]);

  // El nido sigue al dispositivo: si te moviste más de 300 m, el próximo vuelo
  // sale desde donde estás ahora y no desde donde estabas cuando te registraste.
  const yoId = est.yo?.id;
  const yoLat = est.yo?.lat;
  const yoLng = est.yo?.lng;
  const refrescar = est.refrescar;
  useEffect(() => {
    if (!yoId || yoLat === undefined || yoLng === undefined) return;
    let cancelado = false;
    (async () => {
      const r = await pedirUbicacion();
      if (!r.ok || cancelado) return;
      if (distanciaKm({ lat: yoLat, lng: yoLng }, r.punto) < 0.3) return;
      try {
        await pedir("/api/ubicacion", { datos: r.punto });
        refrescar();
      } catch {}
    })();
    return () => {
      cancelado = true;
    };
    // Solo al entrar: pedir el GPS en cada consulta sería un abuso de batería.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yoId]);

  if (est.cargando && !est.yo) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        <Ave especie="loro" size={54} aletea />
      </div>
    );
  }

  if (!est.yo) {
    return (
      <Onboarding
        alTerminar={() => {
          pedirPermisoAvisos();
          est.refrescar();
        }}
      />
    );
  }

  const enVuelo = est.loros.filter((l) => !l.llego);

  return (
    <div className="app">
      <div className="app-mapa">
        {aviso && <div className="aviso entra">{aviso}</div>}

        <Mapa
          yo={est.yo}
          amigos={est.amigos}
          vuelos={enVuelo}
          ahoraServidor={est.ahoraServidor}
          foco={foco}
        />

        {/* left: 56 y no 12 — el control de zoom de Leaflet vive en la esquina. */}
        <div className="flotante" style={{ top: 12, left: 56, pointerEvents: "none" }}>
          <Ave especie="loro" size={20} />
          <span>Loros</span>
          {enVuelo.length > 0 && (
            <span style={{ color: "var(--esmeralda-alto)" }}>· {enVuelo.length} en el aire</span>
          )}
        </div>

        <button
          className="flotante"
          style={{ top: 12, right: 12 }}
          onClick={() => enfocar(est.yo!.id)}
          title="Centrar el mapa en tu nido"
        >
          📍 Mi nido
        </button>

        {est.error && (
          <div className="flotante" style={{ bottom: 12, left: 12, color: "#fca5a5" }}>
            {est.error}
          </div>
        )}
      </div>

      <div className="app-panel">
        <Panel
          yo={est.yo}
          codigo={est.codigo}
          amigos={est.amigos}
          loros={est.loros}
          escala={est.escala}
          ahoraServidor={est.ahoraServidor}
          alEnfocar={enfocar}
          alEscribir={(id) => setCompositor({ abierto: true, para: id })}
          refrescar={est.refrescar}
        />
        <div className="pie-panel">
          <button
            className="boton"
            style={{ width: "100%" }}
            onClick={() => setCompositor({ abierto: true })}
          >
            🦜 Soltar un loro
          </button>
        </div>
      </div>

      {compositor.abierto && (
        <Compositor
          yo={est.yo}
          amigos={est.amigos}
          escala={est.escala}
          destinoInicial={compositor.para}
          alCerrar={() => setCompositor({ abierto: false })}
          alEnviado={(mensaje) => {
            setCompositor({ abierto: false });
            mostrarAviso(`🪶 ${mensaje}`);
            pedirPermisoAvisos();
            est.refrescar();
          }}
        />
      )}
    </div>
  );
}

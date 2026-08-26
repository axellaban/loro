"use client";

// El mapa, con los nidos y las aves en vuelo.
//
// Dos decisiones que explican casi todo el archivo:
//
// 1. La posición del ave NO viene del servidor. Viene de la fórmula: con la
//    hora de salida, la de llegada y los dos puntos alcanza. El servidor se
//    consulta cada varios segundos y el ave igual se mueve a 60 cuadros por
//    segundo, porque cada cuadro se recalcula acá.
//
// 2. Leaflet no es React: no se puede redibujar el mapa entero en cada render.
//    Las capas se crean una vez por vuelo, se guardan en un ref indexadas por
//    id, y después solo se mueven. Cuando un vuelo desaparece de la lista, se
//    saca su capa.
//
// Sin API key: los mosaicos salen de CARTO sobre OpenStreetMap. Si hay un token
// de Mapbox cargado, se usa ese en su lugar.

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AVES } from "../lib/aves";
import { desplazar, puntoEnRuta, rumbo, ruta, type Punto } from "../lib/geo";
import { aveHtml } from "./Ave";
import type { LoroVista, NidoVista } from "../lib/vista";

const MAPBOX = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

function capaBase(): L.TileLayer {
  if (MAPBOX) {
    return L.tileLayer(
      `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX}`,
      {
        maxZoom: 20,
        tileSize: 512,
        zoomOffset: -1,
        attribution:
          '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }
    );
  }
  return L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 20,
      subdomains: "abcd",
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
    }
  );
}

function iconoNido(n: NidoVista, esMio: boolean): L.DivIcon {
  const color = esMio ? "#10b981" : n.bot ? "#22d3ee" : "#e9f3f0";
  // Solo el nido propio late y es un punto lleno. El de los demás es apenas un
  // centro tenue adentro de su zona: el dato preciso no existe, y el dibujo no
  // tiene que aparentar que sí.
  const cuerpo = esMio
    ? `<span style="position:absolute;inset:0;border-radius:99px;background:${color};animation:latido 2.4s ease-out infinite"></span>
       <span style="position:absolute;inset:0;border-radius:99px;background:${color};border:2px solid rgba(6,13,12,.9);box-shadow:0 0 12px ${color}88"></span>`
    : `<span style="position:absolute;inset:3px;border-radius:99px;background:${color};opacity:.75;border:2px solid rgba(6,13,12,.8)"></span>`;
  return L.divIcon({
    className: "marcador-nido",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<div style="position:relative;width:14px;height:14px">
      ${cuerpo}
      <span style="position:absolute;left:50%;top:17px;transform:translateX(-50%);white-space:nowrap;font:600 11px/1 ui-sans-serif,system-ui;color:#e9f3f0;text-shadow:0 1px 4px #000,0 0 10px #000;pointer-events:none">${escapar(
        esMio ? "Tu nido" : n.nombre
      )}</span>
    </div>`,
  });
}

function iconoAve(especie: keyof typeof AVES, grados: number): L.DivIcon {
  return L.divIcon({
    className: "marcador-ave",
    iconSize: [34, 28],
    iconAnchor: [17, 14],
    // El rotado va en un div interno: el externo lo posiciona Leaflet con su
    // propio transform y pisarlo rompe el mapa.
    html: `<div style="width:34px;height:28px;display:grid;place-items:center">
      <div data-rot style="transform:rotate(${grados}deg);filter:drop-shadow(0 2px 6px rgba(0,0,0,.8))">${aveHtml(
        especie,
        34
      )}</div>
    </div>`,
  });
}

function escapar(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string
  );
}

type CapaVuelo = {
  completa: L.Polyline;
  recorrida: L.Polyline;
  ave: L.Marker;
  puntos: Punto[];
};

export default function Mapa({
  yo,
  amigos,
  vuelos,
  ahoraServidor,
  foco,
  modoElegir = false,
  alElegirPunto,
}: {
  yo: NidoVista | null;
  amigos: NidoVista[];
  vuelos: LoroVista[];
  ahoraServidor: () => number;
  /** "<id>#<nonce>": id de un loro o de un nido para centrar la cámara. El
   *  número de atrás permite volver a enfocar lo mismo dos veces seguidas. */
  foco?: string | null;
  modoElegir?: boolean;
  alElegirPunto?: (p: Punto) => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const nidos = useRef(new Map<string, L.Marker>());
  const zonas = useRef(new Map<string, L.Circle>());
  const capas = useRef(new Map<string, CapaVuelo>());
  const encuadrado = useRef(false);
  const alElegirRef = useRef(alElegirPunto);
  alElegirRef.current = alElegirPunto;
  const ahoraRef = useRef(ahoraServidor);
  ahoraRef.current = ahoraServidor;
  const [sinMosaicos, setSinMosaicos] = useState(false);

  // ---- crear el mapa una sola vez ----
  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    const m = L.map(contenedor.current, {
      zoomControl: true,
      worldCopyJump: true,
      // El zoom con la rueda sin modificador secuestra el scroll de la página
      // en mobile; con el mapa a pantalla completa no molesta.
      scrollWheelZoom: true,
    }).setView([-34.6, -58.44], 11);

    // Los mosaicos vienen de un proveedor externo. Si no llegan —sin internet,
    // una red que los bloquea— el mapa igual sirve: las rutas y las aves se
    // dibujan sobre el fondo. Pero hay que decirlo, o parece que se rompió.
    const base = capaBase();
    let fallos = 0;
    let alguno = false;
    base.on("tileload", () => {
      alguno = true;
      setSinMosaicos(false);
    });
    base.on("tileerror", () => {
      fallos += 1;
      if (!alguno && fallos > 4) setSinMosaicos(true);
    });
    base.addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => {
      alElegirRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    mapa.current = m;

    // Si el contenedor cambia de tamaño (rotar el celular, abrir el panel),
    // Leaflet no se entera solo y quedan mosaicos grises.
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(contenedor.current);

    return () => {
      ro.disconnect();
      m.remove();
      mapa.current = null;
      nidos.current.clear();
      zonas.current.clear();
      capas.current.clear();
    };
  }, []);

  useEffect(() => {
    const el = contenedor.current;
    if (el) el.style.cursor = modoElegir ? "crosshair" : "";
  }, [modoElegir]);

  // ---- nidos ----
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;

    const todos = [...(yo ? [yo] : []), ...amigos];
    const vistos = new Set<string>();

    for (const n of todos) {
      vistos.add(n.id);
      const esMio = n.id === yo?.id;
      const existente = nidos.current.get(n.id);
      const icono = iconoNido(n, esMio);
      if (existente) {
        existente.setLatLng([n.lat, n.lng]);
        existente.setIcon(icono);
      } else {
        nidos.current.set(n.id, L.marker([n.lat, n.lng], { icon: icono }).addTo(m));
      }

      // El círculo NO es decoración: es el tamaño real de lo que no sabemos.
      // De la otra persona llega un punto corrido al azar hasta `radioKm`, así
      // que dibujar un pin sería mentir con precisión de metros.
      if (n.radioKm > 0) {
        const zona = zonas.current.get(n.id);
        if (zona) {
          zona.setLatLng([n.lat, n.lng]);
        } else {
          zonas.current.set(
            n.id,
            L.circle([n.lat, n.lng], {
              radius: n.radioKm * 1000,
              color: n.bot ? "#22d3ee" : "#94a3b8",
              weight: 1,
              opacity: 0.35,
              dashArray: "4 7",
              fillColor: n.bot ? "#22d3ee" : "#cbd5e1",
              fillOpacity: 0.07,
              interactive: false,
            }).addTo(m)
          );
        }
      }
    }
    for (const [id, marcador] of nidos.current) {
      if (!vistos.has(id)) {
        marcador.remove();
        nidos.current.delete(id);
      }
    }
    for (const [id, zona] of zonas.current) {
      if (!vistos.has(id)) {
        zona.remove();
        zonas.current.delete(id);
      }
    }

    // Encuadre inicial: una sola vez, cuando ya hay algo que encuadrar. Después
    // manda la persona — nada peor que un mapa que te devuelve al centro solo.
    if (!encuadrado.current && todos.length > 0) {
      encuadrado.current = true;
      // Leaflet encuadra contra el tamaño que CREE que tiene el contenedor. Si
      // los datos llegan antes de que se entere del tamaño real, calcula el
      // zoom para una caja equivocada y deja los dos nidos pegados.
      m.invalidateSize();
      if (todos.length === 1 && todos[0].radioKm === 0) {
        m.setView([todos[0].lat, todos[0].lng], 13);
      } else {
        // El encuadre tiene que abarcar las ZONAS, no los puntos: si se calcula
        // sobre los centros, un círculo de 3 km termina ocupando toda la
        // pantalla y no se entiende nada.
        const limites = L.latLngBounds([]);
        for (const n of todos) {
          if (n.radioKm > 0) {
            for (const grados of [0, 90, 180, 270]) {
              const p = desplazar({ lat: n.lat, lng: n.lng }, n.radioKm, grados);
              limites.extend([p.lat, p.lng]);
            }
          } else {
            limites.extend([n.lat, n.lng]);
          }
        }
        m.fitBounds(limites, { padding: [50, 50], maxZoom: 14 });
      }
    }
  }, [yo, amigos]);

  // ---- vuelos: crear y sacar capas ----
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;

    const vistos = new Set<string>();
    for (const v of vuelos) {
      vistos.add(v.id);
      if (capas.current.has(v.id)) continue;

      const color = AVES[v.ave].color;
      const puntos = ruta(v.origen, v.destino, 96);
      const latlngs = puntos.map((p) => [p.lat, p.lng] as [number, number]);

      capas.current.set(v.id, {
        puntos,
        completa: L.polyline(latlngs, {
          color,
          weight: 1.5,
          opacity: 0.3,
          dashArray: "3 9",
          interactive: false,
        }).addTo(m),
        recorrida: L.polyline([], {
          color,
          weight: 3.5,
          opacity: 0.95,
          interactive: false,
        }).addTo(m),
        ave: L.marker([v.origen.lat, v.origen.lng], {
          icon: iconoAve(v.ave, 0),
          interactive: false,
          zIndexOffset: 500,
        }).addTo(m),
      });
    }

    for (const [id, capa] of capas.current) {
      if (vistos.has(id)) continue;
      capa.completa.remove();
      capa.recorrida.remove();
      capa.ave.remove();
      capas.current.delete(id);
    }
  }, [vuelos]);

  // ---- animación ----
  useEffect(() => {
    let vivo = true;
    let cuadro = 0;

    const paso = () => {
      if (!vivo) return;
      const ahora = ahoraRef.current();

      for (const v of vuelos) {
        const capa = capas.current.get(v.id);
        if (!capa) continue;

        const total = Math.max(1, v.llegada - v.salida);
        const t = Math.min(1, Math.max(0, (ahora - v.salida) / total));

        const pos = puntoEnRuta(v.origen, v.destino, t);
        capa.ave.setLatLng([pos.lat, pos.lng]);

        // Lo recorrido: los puntos de la ruta que quedaron atrás, más el punto
        // exacto donde está el ave, para que la línea le llegue justo al pico.
        const corte = Math.floor(t * (capa.puntos.length - 1));
        const trozo = capa.puntos
          .slice(0, corte + 1)
          .map((p) => [p.lat, p.lng] as [number, number]);
        trozo.push([pos.lat, pos.lng]);
        capa.recorrida.setLatLngs(trozo);

        // Rumbo: hacia dónde va desde acá. Cerca del final se mira el punto
        // anterior para no quedar apuntando a ninguna parte.
        const adelante = puntoEnRuta(v.origen, v.destino, Math.min(1, t + 0.01));
        const grados =
          t < 0.995 ? rumbo(pos, adelante) : rumbo(puntoEnRuta(v.origen, v.destino, 0.98), pos);
        const el = capa.ave.getElement()?.querySelector("[data-rot]") as HTMLElement | null;
        if (el) el.style.transform = `rotate(${grados - 90}deg)`;
      }

      cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);

    return () => {
      vivo = false;
      cancelAnimationFrame(cuadro);
    };
  }, [vuelos]);

  // ---- cámara ----
  useEffect(() => {
    const m = mapa.current;
    if (!m || !foco) return;
    const id = foco.split("#")[0];

    const vuelo = vuelos.find((v) => v.id === id);
    if (vuelo) {
      const t = Math.min(
        1,
        Math.max(0, (ahoraRef.current() - vuelo.salida) / Math.max(1, vuelo.llegada - vuelo.salida))
      );
      const p = puntoEnRuta(vuelo.origen, vuelo.destino, t);
      m.flyTo([p.lat, p.lng], Math.max(m.getZoom(), 11), { duration: 0.9 });
      return;
    }
    const nido = [...(yo ? [yo] : []), ...amigos].find((n) => n.id === id);
    if (nido) m.flyTo([nido.lat, nido.lng], Math.max(m.getZoom(), 13), { duration: 0.9 });
    // `vuelos` a propósito fuera de las dependencias: cambia en cada consulta y
    // volvería a mover la cámara sola cada vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco]);

  return (
    <>
      <div ref={contenedor} style={{ position: "absolute", inset: 0 }} />
      {sinMosaicos && (
        <div
          className="flotante"
          style={{ bottom: 34, left: 12, color: "var(--suave)", cursor: "default" }}
        >
          🗺 Sin mosaicos del mapa — los vuelos se siguen viendo
        </div>
      )}
    </>
  );
}

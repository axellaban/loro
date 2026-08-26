"use client";

// El estado del lado del navegador.
//
// Un solo endpoint (`/api/estado`) trae todo, y de ahí sale la pantalla entera.
// La frecuencia no es fija: con aves en el aire se consulta seguido, sin nada
// volando se afloja. Y cuando la app queda en segundo plano se corta del todo —
// en el celular eso es batería, y al volver se refresca de inmediato.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Punto } from "./geo";
import type { LoroVista, NidoVista } from "./vista";

export type Estado = {
  yo: NidoVista | null;
  codigo: string;
  amigos: NidoVista[];
  loros: LoroVista[];
  /** Escala de tiempo del servidor. El navegador calcula los ETA con la misma. */
  escala: number;
};

const VACIO: Estado = { yo: null, codigo: "", amigos: [], loros: [], escala: 1 };

export async function pedir<T = any>(
  url: string,
  opciones?: { metodo?: string; datos?: unknown }
): Promise<T> {
  const r = await fetch(url, {
    method: opciones?.metodo || (opciones?.datos ? "POST" : "GET"),
    headers: opciones?.datos ? { "Content-Type": "application/json" } : undefined,
    body: opciones?.datos ? JSON.stringify(opciones.datos) : undefined,
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Algo salió mal.");
  return j as T;
}

export function useEstado() {
  const [estado, setEstado] = useState<Estado>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  // Diferencia entre el reloj del servidor y el de este dispositivo. Sin esto,
  // un celular con la hora corrida cinco minutos ve loros que ya llegaron o que
  // nunca llegan.
  const desfase = useRef(0);
  const enVuelo = useRef(false);

  const refrescar = useCallback(async () => {
    // Si la consulta anterior sigue abierta (red lenta), no se encima otra.
    if (enVuelo.current) return;
    enVuelo.current = true;
    try {
      const antes = Date.now();
      const j = await pedir<any>("/api/estado");
      // Se descuenta medio viaje de ida y vuelta: la respuesta se armó más o
      // menos a la mitad del pedido.
      desfase.current = Number(j.ahora) - (antes + Date.now()) / 2;
      setEstado({
        yo: j.yo ?? null,
        codigo: j.codigo || "",
        amigos: j.amigos || [],
        loros: j.loros || [],
        escala: Number(j.escala) > 0 ? Number(j.escala) : 1,
      });
      setError("");
    } catch (e: any) {
      setError(e?.message || "Sin conexión.");
    } finally {
      enVuelo.current = false;
      setCargando(false);
    }
  }, []);

  const ahoraServidor = useCallback(() => Date.now() + desfase.current, []);

  const hayVuelos = estado.loros.some((l) => !l.llego);

  useEffect(() => {
    refrescar();
    let id: ReturnType<typeof setInterval> | null = null;

    const arrancar = () => {
      if (id) clearInterval(id);
      id = setInterval(refrescar, hayVuelos ? 4000 : 12000);
    };
    const alVolver = () => {
      if (document.visibilityState === "visible") {
        refrescar();
        arrancar();
      } else if (id) {
        clearInterval(id);
        id = null;
      }
    };

    arrancar();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", refrescar);
    return () => {
      if (id) clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", refrescar);
    };
  }, [refrescar, hayVuelos]);

  return { ...estado, cargando, error, refrescar, ahoraServidor, setEstado };
}

/** Un tic por segundo, para los contadores que bajan solos. */
export function useTic(activo = true): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => setT((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [activo]);
  return t;
}

export type ResultadoUbicacion =
  | { ok: true; punto: Punto }
  | { ok: false; motivo: string; denegado: boolean };

export function pedirUbicacion(): Promise<ResultadoUbicacion> {
  return new Promise((listo) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      listo({
        ok: false,
        denegado: false,
        motivo: "Este navegador no sabe dónde está.",
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => listo({ ok: true, punto: { lat: p.coords.latitude, lng: p.coords.longitude } }),
      (err) =>
        listo({
          ok: false,
          denegado: err.code === err.PERMISSION_DENIED,
          motivo:
            err.code === err.PERMISSION_DENIED
              ? "Bloqueaste la ubicación. Podés habilitarla en el candado de la barra de direcciones, o poner tu nido a mano."
              : "No se pudo leer el GPS. Probá de nuevo o poné tu nido a mano.",
        }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 }
    );
  });
}

/** Aviso del sistema cuando un ave aterriza y la app no está adelante. */
export async function pedirPermisoAvisos(): Promise<void> {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") await Notification.requestPermission();
  } catch {}
}

export function avisar(titulo: string, cuerpo: string): void {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    new Notification(titulo, { body: cuerpo, icon: "/icono.svg", tag: titulo });
  } catch {}
}

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
  /** "upstash" | "archivo". Sirve para explicar por qué se pierde un nido. */
  almacenamiento: string;
};

const VACIO: Estado = {
  yo: null,
  codigo: "",
  amigos: [],
  loros: [],
  escala: 1,
  almacenamiento: "",
};

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
  /** Alguien pidió refrescar mientras había una consulta abierta. */
  const pendiente = useRef(false);
  /** Tuvimos nido alguna vez. Si el servidor deja de verlo, es un problema. */
  const huboNido = useRef(false);

  const refrescar = useCallback(async () => {
    // Dos consultas encimadas no sirven de nada, pero DESCARTAR la segunda sí
    // hace daño: el pedido que se hace justo después de armar el nido caía
    // siempre en esta rama y la app se quedaba esperando el tic del intervalo,
    // hasta doce segundos, con el botón clavado en "Armando el nido…". Ahora
    // se anota y se corre apenas termina la que estaba.
    if (enVuelo.current) {
      pendiente.current = true;
      return;
    }
    enVuelo.current = true;
    try {
      const antes = Date.now();
      const j = await pedir<any>("/api/estado");
      // Se descuenta medio viaje de ida y vuelta: la respuesta se armó más o
      // menos a la mitad del pedido.
      desfase.current = Number(j.ahora) - (antes + Date.now()) / 2;

      if (j.yo) huboNido.current = true;

      if (!j.yo && huboNido.current) {
        // Teníamos nido y el servidor dejó de encontrarlo. En vez de mandar a
        // la persona de vuelta al onboarding —donde crearía otro nido y
        // perdería su código y su bandada— se conserva lo que hay y se dice
        // qué pasa. La causa casi siempre es la misma y la nombramos.
        setError(
          j.almacenamiento === "archivo"
            ? "El servidor no encuentra tu nido. Está guardando en memoria, así que cada instancia arranca vacía: falta configurar Upstash (KV_REST_API_URL y KV_REST_API_TOKEN) y volver a deployar."
            : "El servidor no encuentra tu nido. Puede ser que se haya borrado la cookie de este navegador."
        );
        return;
      }

      setEstado({
        yo: j.yo ?? null,
        codigo: j.codigo || "",
        amigos: j.amigos || [],
        loros: j.loros || [],
        escala: Number(j.escala) > 0 ? Number(j.escala) : 1,
        almacenamiento: String(j.almacenamiento || ""),
      });
      setError("");
    } catch (e: any) {
      setError(e?.message || "Sin conexión.");
    } finally {
      enVuelo.current = false;
      setCargando(false);
      if (pendiente.current) {
        pendiente.current = false;
        refrescarRef.current?.();
      }
    }
  }, []);

  // El propio refrescar se llama a sí mismo cuando quedó uno pendiente; el ref
  // rompe el círculo de la definición.
  const refrescarRef = useRef(refrescar);
  refrescarRef.current = refrescar;

  /**
   * Planta el nido que acaba de devolver /api/nido, sin esperar una consulta.
   *
   * Es lo que hace que armar el nido lleve al mapa en el acto: el dato ya vino
   * en la respuesta del POST, y salir a buscarlo de nuevo era la diferencia
   * entre entrar al toque y quedarse mirando un botón.
   */
  const sembrar = useCallback((yo: NidoVista, codigo: string) => {
    huboNido.current = true;
    setEstado((prev) => ({ ...prev, yo, codigo }));
    setCargando(false);
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

  return { ...estado, cargando, error, refrescar, sembrar, ahoraServidor, setEstado };
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

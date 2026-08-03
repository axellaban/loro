"use client";

// El pase del lado del navegador.
//
// Guardamos el CÓDIGO, no el "sí, tiene pase": la app no puede verificar la
// firma, así que cada vez que arranca le pregunta al servidor. Si guardáramos
// un booleano, un pase vencido seguiría abriendo puertas para siempre y
// alcanzaría con editar el localStorage para tener acceso ilimitado.

import { useCallback, useEffect, useState } from "react";
import { PASS_QUERY, normalizePassInput, type PassPlan } from "./pass";

const PASS_KEY = "loreado:pass:v1";

/**
 * De dónde salió el pase que está guardado: lo pegó la persona en ESTE
 * navegador ("local") o se lo trajo su cuenta de Google al entrar ("cuenta").
 *
 * Importa para una sola cosa, y es al salir: un pase que llegó con la cuenta
 * se va con ella. Si no, en una computadora compartida el siguiente que la usa
 * se queda con el pase del anterior — que es justo lo que vinimos a evitar. El
 * pase pegado a mano se queda, porque ese lo puso quien está sentado ahí.
 */
const ORIGEN_KEY = "loreado:pass:origen:v1";

/**
 * Qué pase llegó por link en ESTA carga de página.
 *
 * Vive fuera del componente porque el efecto puede correr dos veces (React lo
 * hace en desarrollo) y para la segunda el `?pase=` ya no está en la URL: lo
 * borramos en la primera. Sin esta memoria, el pase se activa pero la fiesta
 * no se dispara. Se reinicia sola en la próxima carga, que es justo lo que
 * queremos: entrar por el link se festeja, recargar no.
 */
let tokenDelLink: string | null = null;

export type ActivePass = { email: string; expiresAt: number; plan: PassPlan };

export function storedPassToken(): string {
  try {
    return localStorage.getItem(PASS_KEY) || "";
  } catch {
    return "";
  }
}

async function redeem(token: string): Promise<{ pass?: ActivePass; error?: string }> {
  // Con tope: mientras esta llamada no termina, el botón de arrancar está
  // deshabilitado. Sin timeout, una red que se cuelga (y no falla) dejaría la
  // app trabada justo para la gente que pagó.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch("/api/pass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      signal: ctrl.signal,
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) {
      return { pass: { email: j.email, expiresAt: j.expiresAt, plan: j.plan } };
    }
    // El código HTTP va en el mensaje a propósito. Sin él, "falta la variable
    // en el server", "el endpoint no existe en este deploy" y "el pase está
    // mal copiado" se ven todos iguales, y no hay forma de saber a quién
    // reclamarle. Con el número, se resuelve mirando una vez.
    if (j?.error) return { error: j.error };
    return { error: `No se pudo validar el pase (error ${r.status}).` };
  } catch {
    return { error: "No hay conexión para validar el pase." };
  } finally {
    clearTimeout(t);
  }
}

export function usePass() {
  const [pass, setPass] = useState<ActivePass | null>(null);
  // "checking" mientras se valida al arrancar: sin esto la app parpadea el
  // paywall en la cara de alguien que ya pagó.
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  /**
   * Se activó RECIÉN (abrió el link o pegó el código), no "ya lo tenía". Es lo
   * que dispara la fiesta: se festeja el momento de entrar, no cada recarga.
   */
  const [celebrate, setCelebrate] = useState(false);

  const apply = useCallback(
    (
      token: string,
      res: { pass?: ActivePass; error?: string },
      festejar = false,
      origen: "local" | "cuenta" = "local"
    ) => {
      if (res.pass) {
        setPass(res.pass);
        setError("");
        if (festejar) setCelebrate(true);
        try {
          localStorage.setItem(PASS_KEY, token);
          localStorage.setItem(ORIGEN_KEY, origen);
        } catch {}
        return true;
      }
      setPass(null);
      setError(res.error || "");
      return false;
    },
    []
  );

  /**
   * El pase que trajo la cuenta al entrar con Google. Ya viene verificado por
   * el servidor —es el mismo que emitió /api/auth—, así que no se revalida:
   * sería un viaje de red de más para preguntar lo que acabamos de responder.
   */
  const adoptar = useCallback(
    (traido: ActivePass & { token: string }) => {
      const yaTenia = storedPassToken();
      apply(traido.token, { pass: traido }, !yaTenia, "cuenta");
    },
    [apply]
  );

  /**
   * Al salir de la cuenta: se va el pase que vino con ella, se queda el que
   * pegó a mano quien está usando esta computadora.
   */
  const olvidarSiEsDeCuenta = useCallback(() => {
    try {
      if (localStorage.getItem(ORIGEN_KEY) !== "cuenta") return;
      localStorage.removeItem(PASS_KEY);
      localStorage.removeItem(ORIGEN_KEY);
    } catch {}
    setPass(null);
  }, []);

  // Al cargar: primero el pase del link (?pase=…), si no el guardado.
  useEffect(() => {
    let vivo = true;
    (async () => {
      let fromUrl = "";
      try {
        fromUrl = new URLSearchParams(window.location.search).get(PASS_QUERY) || "";
      } catch {}

      if (fromUrl) {
        tokenDelLink = fromUrl;
        // Se guarda ANTES de validar, a propósito. El código sale de la URL
        // enseguida (para que no quede en el historial ni se filtre por el
        // Referer), así que si no lo guardáramos primero y la validación se
        // cortara —red caída, o el efecto re-ejecutándose— el pase quedaría
        // perdido y la persona tendría que pedirme el link de nuevo. Si resulta
        // inválido se borra unas líneas más abajo.
        try {
          localStorage.setItem(PASS_KEY, fromUrl);
        } catch {}
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete(PASS_QUERY);
          window.history.replaceState({}, "", url.pathname + url.search + url.hash);
        } catch {}
      }

      const token = fromUrl || storedPassToken();
      if (!token) {
        if (vivo) setChecking(false);
        return;
      }
      const res = await redeem(token);
      if (!vivo) return;
      if (!res.pass) {
        // No vale: se borra siempre. Si el error fue de red el pase se
        // recupera volviendo a abrir el link, que es lo que la persona tiene.
        try {
          localStorage.removeItem(PASS_KEY);
          localStorage.removeItem(ORIGEN_KEY);
        } catch {}
      }
      // Se festeja solo si el pase vino del link en esta carga: entrar por
      // primera vez es el momento, recargar la página no.
      apply(token, res, token === tokenDelLink);
      setChecking(false);
    })();
    return () => {
      vivo = false;
    };
  }, [apply]);

  /** Canje manual, desde el input "¿Ya sos Loro?". */
  const activate = useCallback(
    async (token: string) => {
      const clean = normalizePassInput(token);
      if (!clean) return false;
      setError("");
      return apply(clean, await redeem(clean), true);
    },
    [apply]
  );

  const endCelebration = useCallback(() => setCelebrate(false), []);

  return {
    pass,
    checking,
    error,
    activate,
    celebrate,
    endCelebration,
    adoptar,
    olvidarSiEsDeCuenta,
  };
}

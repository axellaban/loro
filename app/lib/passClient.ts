"use client";

// El pase del lado del navegador.
//
// Guardamos el CÓDIGO, no el "sí, tiene pase": la app no puede verificar la
// firma, así que cada vez que arranca le pregunta al servidor. Si guardáramos
// un booleano, un pase vencido seguiría abriendo puertas para siempre y
// alcanzaría con editar el localStorage para tener acceso ilimitado.

import { useCallback, useEffect, useState } from "react";
import { PASS_QUERY, type PassPlan } from "./pass";

const PASS_KEY = "loreado:pass:v1";

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
    const j = await r.json().catch(() => ({}));
    if (r.ok && j?.ok) {
      return { pass: { email: j.email, expiresAt: j.expiresAt, plan: j.plan } };
    }
    return { error: j?.error || "No se pudo validar el pase." };
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

  const apply = useCallback((token: string, res: { pass?: ActivePass; error?: string }) => {
    if (res.pass) {
      setPass(res.pass);
      setError("");
      try {
        localStorage.setItem(PASS_KEY, token);
      } catch {}
      return true;
    }
    setPass(null);
    setError(res.error || "");
    return false;
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
        } catch {}
      }
      apply(token, res);
      setChecking(false);
    })();
    return () => {
      vivo = false;
    };
  }, [apply]);

  /** Canje manual, desde el input "¿Tenés un pase?". */
  const activate = useCallback(
    async (token: string) => {
      const clean = token.trim();
      if (!clean) return false;
      setError("");
      return apply(clean, await redeem(clean));
    },
    [apply]
  );

  return { pass, checking, error, activate };
}

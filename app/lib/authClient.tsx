"use client";

// Entrar con Google, del lado del navegador.
//
// El flujo es el de Google Identity Services: su script dibuja el botón, la
// persona elige la cuenta, y Google nos devuelve un ID token firmado. Ese token
// va a /api/auth, que lo verifica de verdad y deja una cookie de sesión. El
// navegador nunca decide por su cuenta quién entró — solo transporta la prueba.
//
// Todo esto es opcional: si NEXT_PUBLIC_GOOGLE_CLIENT_ID no está cargado, el
// hook devuelve `configurado: false` y la app no muestra nada de login. Sigue
// funcionando igual que antes.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivePass } from "./passClient";

const SRC = "https://accounts.google.com/gsi/client";

export type Cuenta = { sub: string; email: string; nombre: string; foto: string };

declare global {
  interface Window {
    google?: any;
  }
}

/**
 * Carga el script de Google una sola vez por página, aunque lo pidan varios
 * componentes. La promesa se comparte: el segundo que llega espera la misma.
 */
let cargando: Promise<boolean> | null = null;
function cargarGoogle(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.google?.accounts?.id) return Promise.resolve(true);
  if (cargando) return cargando;
  cargando = new Promise<boolean>((listo) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => listo(Boolean(window.google?.accounts?.id));
    // Con un bloqueador de anuncios el script no carga. No es un error que
    // haya que mostrar: simplemente no hay login y la app anda igual.
    s.onerror = () => listo(false);
    document.head.appendChild(s);
  });
  return cargando;
}

export type Auth = ReturnType<typeof useAuth>;

/**
 * @param alEntrar se llama con el pase de la cuenta cuando alguien entra y ese
 *   pase existe. Es el momento en que el pase "viaja" al dispositivo nuevo.
 */
export function useAuth(alEntrar?: (pase: ActivePass & { token: string }) => void) {
  // Recortado por lo mismo que en el servidor: un espacio invisible pegado al
  // valor en Vercel hace que Google conteste "invalid_client", que es un error
  // que no se parece en nada a su causa.
  const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  // `checking` mientras se pregunta por la sesión: sin esto el botón de entrar
  // parpadea en la cara de alguien que ya está adentro.
  const [checking, setChecking] = useState(Boolean(clientId));
  const [error, setError] = useState("");
  const [listoGoogle, setListoGoogle] = useState(false);

  // La última versión del callback, para que el `initialize` de Google (que
  // corre una sola vez) no se quede con una copia vieja.
  const alEntrarRef = useRef(alEntrar);
  alEntrarRef.current = alEntrar;

  // ¿Ya hay sesión? La cookie es HttpOnly, así que hay que preguntarle al
  // servidor: el JavaScript no puede verla.
  useEffect(() => {
    if (!clientId) return;
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/auth", { cache: "no-store" });
        const j = await r.json().catch(() => null);
        if (!vivo) return;
        if (j?.sesion) {
          setCuenta(j.sesion);
          if (j.pase?.token) alEntrarRef.current?.(j.pase);
        }
      } catch {
        // Sin conexión no hay sesión que mostrar; no es un error para la persona.
      } finally {
        if (vivo) setChecking(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [clientId]);

  // El token que devuelve Google va al servidor, que es quien lo verifica.
  const entrarCon = useCallback(async (credential: string) => {
    setError("");
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setCuenta(j.sesion);
        if (j.pase?.token) alEntrarRef.current?.(j.pase);
        return true;
      }
      setError(j?.error || `No se pudo entrar (error ${r.status}).`);
      return false;
    } catch {
      setError("No hay conexión para entrar con Google.");
      return false;
    }
  }, []);

  // Inicialización de Google. Una sola vez, cuando hay client id.
  useEffect(() => {
    if (!clientId) return;
    let vivo = true;
    (async () => {
      const ok = await cargarGoogle();
      if (!vivo || !ok) return;
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp: any) => {
            if (resp?.credential) entrarCon(resp.credential);
          },
          // Sin One Tap automático: aparecer solo, encima del contenido y sin
          // que nadie lo haya pedido, es intrusivo justo cuando la persona
          // está por arrancar una entrevista.
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        if (vivo) setListoGoogle(true);
      } catch {
        // Client id mal formado o script a medio cargar: sin login, sin drama.
      }
    })();
    return () => {
      vivo = false;
    };
  }, [clientId, entrarCon]);

  const salir = useCallback(async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {}
    setCuenta(null);
    setError("");
    try {
      window.google?.accounts?.id?.disableAutoSelect?.();
    } catch {}
  }, []);

  return {
    configurado: Boolean(clientId),
    listoGoogle,
    cuenta,
    checking,
    error,
    salir,
  };
}

/**
 * El botón oficial de Google. Se usa el suyo y no uno propio porque su marca
 * tiene reglas de uso, y porque el botón real es el que la gente reconoce.
 */
export function BotonGoogle({
  listo,
  ancho,
}: {
  listo: boolean;
  ancho?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const dibujado = useRef(false);

  useEffect(() => {
    if (!listo || dibujado.current || !ref.current) return;
    try {
      window.google.accounts.id.renderButton(ref.current, {
        type: "standard",
        theme: "filled_black",
        size: "large",
        text: "continue_with",
        shape: "pill",
        logo_alignment: "left",
        locale: "es",
        ...(ancho ? { width: ancho } : {}),
      });
      dibujado.current = true;
    } catch {
      // no-op: sin botón, la app sigue andando sin login.
    }
  }, [listo, ancho]);

  return <div ref={ref} className="google-btn" />;
}

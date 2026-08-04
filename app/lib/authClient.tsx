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
  /**
   * ¿Entró RECIÉN, en esta visita, o ya venía con la sesión puesta?
   *
   * La diferencia importa donde entrar con Google reemplaza a dejar el email:
   * ahí lo que vale es el acto de elegirlo, no el hecho de tener una cookie.
   * Sin esta distinción, alguien logueado se salteaba el pedido de email con
   * solo abrir la pantalla, sin haber tocado nada. (Pasó.)
   */
  const [entradaNueva, setEntradaNueva] = useState(false);

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
        setEntradaNueva(true);
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
    setEntradaNueva(false);
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
    entradaNueva,
    salir,
  };
}

/** La G de Google, con sus cuatro colores de marca. */
function LogoG() {
  return (
    <svg className="google-g" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

/**
 * Entrar con Google: se ve solo la G, sin botón ni recuadro.
 *
 * El botón REAL de Google sigue existiendo, pero invisible y estirado justo
 * encima del logo. El click, el teclado y los lectores de pantalla van a él;
 * nosotros solo ponemos lo que se ve.
 *
 * Por qué así y no con la variante de solo ícono de la librería: esa existe
 * (`type: "icon"`) pero en producción salía el círculo vacío, sin la G. Y por
 * qué no un botón propio que dispare el login a mano: el flujo de ID token no
 * se puede lanzar por programa sin caer en One Tap, que el navegador puede
 * suprimir. Con esta forma la apariencia es nuestra y el mecanismo sigue
 * siendo el de Google, que es lo que hay que respetar de su marca.
 */
export function BotonGoogle({ listo }: { listo: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const dibujado = useRef(false);

  useEffect(() => {
    if (!listo || dibujado.current || !ref.current) return;
    try {
      window.google.accounts.id.renderButton(ref.current, {
        type: "icon",
        shape: "square",
        theme: "outline",
        size: "large",
      });
      dibujado.current = true;
    } catch {
      // no-op: sin botón, la app sigue andando sin login.
    }
  }, [listo]);

  return (
    <span className="google-g-wrap">
      <span ref={ref} className="google-g-real" />
      <LogoG />
    </span>
  );
}

/** "O entrá con" + la G. El texto va afuera porque el logo va limpio. */
export function EntrarConGoogle({ listo, className = "" }: { listo: boolean; className?: string }) {
  return (
    <div className={`entrar-google ${className}`}>
      <span className="entrar-google-txt">O entrá con</span>
      <BotonGoogle listo={listo} />
    </div>
  );
}

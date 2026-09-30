"use client";

// Checkout de Lemon Squeezy en overlay: se paga sin salir de Loreado.
//
// Lo usan el pase del copiloto y la semillita del simulador. Los botones son
// <a> con el link de siempre y `target="_blank"`: si lemon.js todavía no cargó
// (red lenta, bloqueador), el click sigue su curso y el checkout se abre en otra
// pestaña como antes. Solo cuando el overlay está listo se frena el link.
//
// No se usa la clase `lemonsqueezy-button` del snippet de Lemon Squeezy: con
// React los botones aparecen y desaparecen, lemon.js no se entera, y además
// abriría el checkout dos veces junto con nuestro onClick.

const SCRIPT = "https://assets.lemonsqueezy.com/lemon.js";

export type LemonEvent = { event: string; data?: unknown };

declare global {
  interface Window {
    createLemonSqueezy?: () => void;
    LemonSqueezy?: {
      Setup: (options: { eventHandler: (event: LemonEvent) => void }) => void;
      Url: { Open: (url: string) => void; Close: () => void };
    };
  }
}

let cargando: Promise<boolean> | null = null;
const oyentes = new Set<(e: LemonEvent) => void>();

function cargar(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.LemonSqueezy) return Promise.resolve(true);
  if (cargando) return cargando;
  cargando = new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.defer = true;
    s.onload = () => {
      try {
        // Inyectado después de cargar la página, lemon.js no siempre se
        // inicializa solo: esto crea window.LemonSqueezy.
        window.createLemonSqueezy?.();
        window.LemonSqueezy?.Setup({
          eventHandler: (e) =>
            oyentes.forEach((fn) => {
              try {
                fn(e);
              } catch {}
            }),
        });
      } catch {}
      resolve(Boolean(window.LemonSqueezy));
    };
    s.onerror = () => {
      // Se puede reintentar más tarde; mientras, los links abren pestaña.
      cargando = null;
      resolve(false);
    };
    document.head.appendChild(s);
  });
  return cargando;
}

/** Carga lemon.js antes de que haga falta, para que el primer click ya abra el overlay. */
export function precargarCheckout() {
  void cargar();
}

/**
 * Abre el checkout en overlay si lemon.js está listo. Devuelve false si no
 * pudo, y ahí el <a> tiene que seguir su curso (no llamar preventDefault).
 */
export function abrirCheckoutEnSitio(url: string): boolean {
  const ls = typeof window !== "undefined" ? window.LemonSqueezy : undefined;
  if (!ls) return false;
  try {
    const u = new URL(url);
    u.searchParams.set("embed", "1");
    ls.Url.Open(u.toString());
    return true;
  } catch {
    return false;
  }
}

/** Avisa cuando se completa una compra en el overlay. Devuelve cómo desuscribirse. */
export function alComprar(fn: () => void): () => void {
  const oyente = (e: LemonEvent) => {
    if (e?.event === "Checkout.Success") fn();
  };
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

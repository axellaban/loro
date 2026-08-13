"use client";

// Qué decirle a quien vuelve de Stripe sin un pase en la mano.
//
// El caso feliz no pasa por acá: cuando el cobro se confirma,
// /api/stripe/return redirige a `/app?pase=…` y lo levanta passClient, con
// fiesta incluida. Esto es para el resto — y el resto existe.
//
// Por qué merece código en vez de dejar la URL colgada: alguien que acaba de
// poner los datos de la tarjeta y aterriza en la app EXACTAMENTE igual que
// antes no concluye "el pago se canceló", concluye "pagué y me robaron". La
// diferencia entre las dos cosas es una línea de texto.
//
// El parámetro se borra de la URL apenas se lee, por la misma razón que el
// pase: que recargar no repita el aviso, y que no quede en el historial.

import { useEffect, useState } from "react";
import { track } from "./track";

const MENSAJES: Record<string, string> = {
  // El caso más común de todos: tocó "Atrás" en Checkout. No es un error y no
  // se escribe como si lo fuera.
  cancelado: "Cancelaste el pago. Cuando quieras, el pase te espera.",
  // El cobro quedó en el aire. Pasa con algunos débitos y con 3D Secure que
  // termina tarde: el webhook lo va a resolver, así que se pide paciencia en
  // vez de mandar a pagar de nuevo (y cobrar dos veces).
  pendiente:
    "Tu pago todavía se está confirmando. En cuanto se acredite, entrá con Google y el pase aparece solo.",
  // De acá para abajo, todos son problemas nuestros. Se dicen como tales: la
  // persona pagó y no tiene que quedarse pensando que hizo algo mal.
  "sin-pase":
    "Cobramos el pago pero no pudimos emitir el pase. Escribime por WhatsApp y lo activo a mano — no vuelvas a pagar.",
  "sin-email":
    "El pago salió bien pero no nos llegó tu email. Escribime por WhatsApp y lo activo a mano — no vuelvas a pagar.",
  error: "Hubo un problema al confirmar el pago. Si te lo cobraron, escribime por WhatsApp antes de reintentar.",
  invalido: "Ese link de pago no es válido.",
  reintenta: "Estamos con muchos pedidos. Recargá la página en un momento.",
};

export function usePagoVuelta(): string {
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let estado = "";
    try {
      estado = new URLSearchParams(window.location.search).get("pago") || "";
    } catch {}
    if (!estado) return;

    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("pago");
      window.history.replaceState({}, "", u.pathname + u.search + u.hash);
    } catch {}

    track(estado === "cancelado" ? "pay_stripe_cancel" : "pay_stripe_error", { estado });
    setAviso(MENSAJES[estado] || "No pudimos confirmar el pago.");
  }, []);

  return aviso;
}

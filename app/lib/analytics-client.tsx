"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

// Vercel Hobby descarta los eventos custom de @vercel/analytics (feature de
// Pro), así que el funnel real vive en PostHog. Solo se inicializa si la key
// pública está seteada; sin ella la app funciona igual y track() queda como
// no-op hacia PostHog.
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";

export function AnalyticsClient() {
  useEffect(() => {
    if (!POSTHOG_KEY || posthog.__loaded) return;
    posthog.init(POSTHOG_KEY, {
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      defaults: "2026-01-30",
      // Solo el funnel explícito de track(): sin autocapture de clicks/inputs
      // (acá se pegan CVs — no queremos ni rozar ese contenido).
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: true,
      // Apagado: no captura casi nada (los errores recurrentes por diseño ya
      // están tragados antes de llegar a window.onerror — el ws.onerror vacío
      // del simulador, el console.error del copiloto, el abort del TTS, el
      // AbortError de las respuestas) y en cambio hace lazy-load del módulo
      // exception-autocapture, que al ir por /ingest se proxea por Vercel: un
      // request y ~20 KB por pageview para capturar cero errores.
      capture_exceptions: false,
      persistence: "localStorage",
      // No usamos feature flags en ningún lado, y sin esto posthog-js pide
      // /ingest/flags en cada init y en cada identify(). Sobre el tráfico de
      // Ads son 1-2 requests por pageview que no sirven para nada. Si algún día
      // se usan flags, esto se saca.
      advanced_disable_decide: true,
    });
  }, []);
  return null;
}

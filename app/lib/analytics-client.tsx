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
      capture_exceptions: true,
      persistence: "localStorage",
    });
  }, []);
  return null;
}

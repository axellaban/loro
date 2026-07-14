"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

// Vercel Hobby descarta los eventos custom de @vercel/analytics (feature de
// Pro), así que el funnel real vive en PostHog. Solo se inicializa si la key
// pública está seteada; sin ella la app funciona igual y track() queda como
// no-op hacia PostHog.
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

export function AnalyticsClient() {
  useEffect(() => {
    if (!POSTHOG_KEY || posthog.__loaded) return;
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      // Solo el funnel explícito de track(): sin autocapture de clicks/inputs
      // (acá se pegan CVs — no queremos ni rozar ese contenido).
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: "localStorage",
    });
  }, []);
  return null;
}

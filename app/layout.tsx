import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { AnalyticsClient } from "./lib/analytics-client";
import "./globals.css";

// Dominio base para resolver OG/Twitter images y URLs absolutas. Se puede
// pisar con NEXT_PUBLIC_SITE_URL en Vercel; default al dominio de producción.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://loreado.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Loreado.IA — El copiloto de IA que RRHH no quiere que uses",
  description:
    "Transcribe tu entrevista en tiempo real y te sopla las respuestas ancladas en tu CV. Gratis, sin instalar nada. 🦜",
  applicationName: "Loreado.IA",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Loreado.IA",
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: SITE_URL,
    siteName: "Loreado.IA",
    title: "El copiloto de IA que RRHH no quiere que uses.",
    description:
      "Transcribe tu entrevista en tiempo real y te sopla las respuestas ancladas en tu CV. Gratis, sin instalar nada. 🦜",
  },
  twitter: {
    card: "summary_large_image",
    title: "El copiloto de IA que RRHH no quiere que uses.",
    description:
      "Transcribe tu entrevista en tiempo real y te sopla las respuestas ancladas en tu CV. 🦜",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Sin maximumScale: bloquear el pinch-zoom rompe accesibilidad (WCAG 1.4.4).
  viewportFit: "cover",
  themeColor: "#f4f5f7",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        {children}
        <Analytics />
        <AnalyticsClient />
      </body>
    </html>
  );
}

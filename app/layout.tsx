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
  keywords: [
    "copiloto de entrevistas",
    "entrevistas con IA",
    "simulador de entrevistas",
    "IA para entrevistas de trabajo",
    "practicar entrevistas",
    "preparación de entrevistas",
    "entrevista de trabajo",
    "Loreado",
  ],
  authors: [{ name: "Loreado.IA" }],
  creator: "Loreado.IA",
  publisher: "Loreado.IA",
  /**
   * Prueba de que el sitio es nuestro, para Google Search Console.
   *
   * Va por etiqueta y no por registro TXT porque el dominio es un subdominio
   * de vercel.app: el DNS es de Vercel y no se le pueden agregar registros. El
   * contenido del sitio, en cambio, sí lo controlamos, y a Google le alcanza
   * con eso. Se puede pisar por env para el día que el sitio viva en un
   * dominio propio con su propio código.
   */
  verification: {
    google:
      process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ||
      "eMR9dfkc49T1jQnxF6h8dzo4kSsXZqSXEhn8gQfxerw",
  },
  formatDetection: { telephone: false, email: false, address: false },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
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
    title: "Nadie se entera de que usás IA en tu entrevista 🤫🦜",
    description:
      "Practicá gratis con un entrevistador de IA y, el día real, el Loro te sopla la respuesta en vivo —armada con tu CV—. 🦜",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nadie se entera de que usás IA en tu entrevista 🤫🦜",
    description:
      "Practicá gratis con un entrevistador de IA y, el día real, el Loro te sopla la respuesta en vivo —armada con tu CV—. 🦜",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Sin maximumScale: bloquear el pinch-zoom rompe accesibilidad (WCAG 1.4.4).
  viewportFit: "cover",
  themeColor: "#f4f5f7",
};

// Datos estructurados (JSON-LD): ayudan a Google (rich results) y a las IA
// (ChatGPT, Perplexity, Gemini) a entender qué es Loreado y citarlo.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Loreado.IA",
      url: SITE_URL,
      logo: `${SITE_URL}/apple-icon`,
      description:
        "Loreado.IA es un asistente de IA para entrevistas de trabajo: un simulador para practicar y un copiloto que te sopla las respuestas en vivo.",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Loreado.IA",
      inLanguage: "es",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: "Loreado.IA",
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "es",
      description:
        "Copiloto y simulador de entrevistas con IA: practicá entrevistas de trabajo con un entrevistador de IA y recibí las respuestas en vivo, armadas con tu CV.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <Analytics />
        <AnalyticsClient />
      </body>
    </html>
  );
}

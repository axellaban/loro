import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITIO = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";

export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
  title: "Loros — Envía Loros, no mensajes",
  description:
    "La app de mensajería donde tu loro viaja en tiempo real según la distancia. Elegí tu ave, escribí, y esperá a que aterrice.",
  applicationName: "Loros",
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "Loros",
    title: "Envía Loros, no mensajes 🦜",
    description:
      "Tu mensaje vuela de verdad: sale desde tu ubicación y tarda lo que tarda. Perico, cotorra, loro o guacamayo — cada uno vuela distinto.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Envía Loros, no mensajes 🦜",
    description:
      "Mensajería donde el mensaje vuela en tiempo real según la distancia real entre ustedes.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#060d0c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

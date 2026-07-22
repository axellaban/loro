import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Copiloto de entrevistas en vivo con IA",
  description:
    "El copiloto de IA que te sopla las respuestas en tu entrevista real, en tiempo real, armadas con tu CV, la empresa y el puesto. 🦜",
  alternates: { canonical: "/app" },
  keywords: [
    "copiloto de entrevistas",
    "entrevistas en tiempo real",
    "IA para entrevistas de trabajo",
    "asistente de entrevistas",
    "respuestas en la entrevista",
  ],
  openGraph: {
    title: "Copiloto de entrevistas en vivo con IA",
    description:
      "Te sopla las respuestas en tu entrevista real, en tiempo real, armadas con tu CV.",
    url: "/app",
  },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

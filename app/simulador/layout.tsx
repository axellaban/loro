import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Simulador de entrevistas con IA — gratis",
  description:
    "Practicá entrevistas de trabajo con un entrevistador de IA por voz y recibí un informe con feedback al instante. Gratis y sin registro. 🦜",
  alternates: { canonical: "/simulador" },
  keywords: [
    "simulador de entrevistas",
    "entrevistas con IA",
    "practicar entrevistas de trabajo",
    "mock interview IA",
    "preparación de entrevistas",
    "feedback de entrevista",
  ],
  openGraph: {
    title: "Simulador de entrevistas con IA — gratis",
    description:
      "Practicá con un entrevistador de IA por voz y recibí feedback al instante. Gratis, sin registro.",
    url: "/simulador",
  },
};

export default function SimuladorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

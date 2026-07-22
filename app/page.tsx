import type { Metadata } from "next";
import Hub from "./Hub";

export const metadata: Metadata = {
  title: "Loreado IA - #1 Asistente de Entrevistas con IA",
  description:
    "Entrená tu entrevista con un entrevistador de IA, gratis y sin login. Y el día real, el copiloto te sopla la respuesta en vivo.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return <Hub />;
}

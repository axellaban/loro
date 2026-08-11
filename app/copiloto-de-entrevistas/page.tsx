import type { Metadata } from "next";
import { AppPage } from "../app/page";

export const metadata: Metadata = {
  title: "Copiloto de entrevistas laborales con IA — Loreado.IA",
  description:
    "Tu asistente de IA para entrevistas de trabajo. Transcripción en tiempo real y respuestas inteligentes ancladas a tu CV y al puesto. Probalo gratis.",
  alternates: { canonical: "/copiloto-de-entrevistas" },
};

// Tagline sin palabras que infringen políticas de Google Ads
// (sin "indetectable", sin "sopla").
const ADS_TAGLINE =
  "Tu asistente de IA para entrevistas laborales. Transcripción en tiempo real y respuestas inteligentes ancladas a tu CV y al puesto. 🦜";

export default function CopiloDeEntrevistasPage() {
  return <AppPage tagline={ADS_TAGLINE} />;
}

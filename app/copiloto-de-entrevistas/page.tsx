import type { Metadata } from "next";
import Hub from "../Hub";

export const metadata: Metadata = {
  title: "Copiloto de entrevistas laborales con IA — Loreado.IA",
  description:
    "Tu asistente de IA para entrevistas de trabajo. Transcripción en tiempo real y respuestas inteligentes ancladas a tu CV y al puesto. Probalo gratis.",
  alternates: { canonical: "/copiloto-de-entrevistas" },
};

// Subtítulo de la pastilla Copiloto sin palabras que violen políticas de Google Ads ("indetectable", "sopla")
const ADS_COPILO_SUB =
  "Respuestas inteligentes en tiempo real, ancladas a tu CV y al puesto.";

export default function CopilotoDeEntrevistasPage() {
  return <Hub copiloSub={ADS_COPILO_SUB} />;
}

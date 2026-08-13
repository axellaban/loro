import type { Metadata } from "next";
import Panel from "./Panel";

// Herramienta interna: fuera de Google y fuera del sitemap. El contenido real
// igual está detrás del token, esto es para que ni siquiera aparezca.
export const metadata: Metadata = {
  title: "Consumo — Loreado.IA",
  robots: { index: false, follow: false },
};

export default function Uso() {
  return <Panel />;
}

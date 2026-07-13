import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Loreado.ia — Acceso Beta",
  description: "El copiloto de IA que RRHH no quiere que uses. Acceso beta cerrado.",
};

export default function Landing() {
  return (
    <div className="landing">
      <main className="landing-main">
        <h1 className="landing-title">
          El copiloto de IA que RRHH no quiere que uses.
        </h1>

        <h2 className="landing-sub">Acceso beta cerrado.</h2>

        <div className="landing-btn-wrap">
          <div className="landing-glow" aria-hidden="true" />
          <Link href="/app" className="landing-btn">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z" fill="currentColor" stroke="none" />
            </svg>
            Entrá
          </Link>
        </div>

        <p className="landing-warn">
          ⚠️ ESTAMOS EXPERIMENTANDO UN TRÁFICO INUSUALMENTE ALTO. NUESTROS SERVIDORES
          ESTÁN OPERANDO AL LÍMITE DE SU CAPACIDAD.
        </p>
      </main>
    </div>
  );
}

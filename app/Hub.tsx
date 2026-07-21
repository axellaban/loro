"use client";

import Link from "next/link";
import { ParrotSvg } from "./lib/parrot";
import { track } from "./lib/track";

// Banderita tipo Final Round con el texto "IA"
function IaFlag() {
  return (
    <svg
      width="35"
      height="30"
      viewBox="0 0 35 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path
        d="M6 2h24a4 4 0 0 1 4 4v2a2 2 0 0 1-.4 1.2L29.5 14l4.1 4.8a2 2 0 0 1 .4 1.2v2a4 4 0 0 1-4 4H9.5L4.5 29.5c-.6.5-1.5.1-1.5-.7V26H4a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4h2z"
        fill="#ff4f12"
      />
      <text
        x="16.5"
        y="14"
        fill="#ffffff"
        fontSize="11"
        fontWeight="bold"
        fontFamily="system-ui, -apple-system, sans-serif"
        textAnchor="middle"
        dominantBaseline="central"
      >
        IA
      </text>
    </svg>
  );
}

// Hub minimal (Luhmann): un solo mensaje y dos puertas. Cero copy que obligue
// a evaluar. El mini-tag de cada puerta le dice cuál es sin tener que entrar.
export default function Hub() {
  return (
    <div className="hub">
      <main className="hub-main">
        <div className="hub-brand" aria-hidden="true">
          <ParrotSvg size={44} />
          <span className="hub-brand-text">Loreado</span>
          <IaFlag />
        </div>

        <h1 className="hub-h1">Metele el Loro (IA) a tus entrevistas</h1>

        <div className="hub-doors-pills">
          <Link
            href="/simulador"
            className="hub-pill-btn hub-pill-blue"
            onClick={() => track("hub_practice_click")}
          >
            <span className="hub-pill-inner">
              <span className="hub-pill-label">Simulador</span>
              <span className="hub-pill-sub">practicá con un entrevistador muy simpático</span>
            </span>
          </Link>

          <Link
            href="/app?ref=copiloto"
            className="hub-pill-btn hub-pill-red"
            onClick={() => track("hub_copilot_click")}
          >
            <span className="hub-pill-glow" />
            <span className="hub-pill-red-card" />
            <span className="hub-pill-inner">
              <span className="hub-pill-label">Copiloto</span>
              <span className="hub-pill-sub">te acompaña durante tu entrevista en tiempo real</span>
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}

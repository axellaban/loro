"use client";

import Link from "next/link";
import { ParrotSvg } from "./lib/parrot";
import { track } from "./lib/track";

// Hub minimal (Luhmann): un solo mensaje y dos puertas. Cero copy que obligue
// a evaluar. El mini-tag de cada puerta le dice cuál es sin tener que entrar.
export default function Hub() {
  return (
    <div className="hub">
      <main className="hub-main">
        <div className="hub-brand" aria-hidden="true">
          <ParrotSvg size={44} />
        </div>

        <h1 className="hub-h1">Metele el Loro (AI) a tus entrevistas</h1>

        <div className="hub-doors">
          <Link
            href="/simulador"
            className="hub-door"
            onClick={() => track("hub_practice_click")}
          >
            <span className="hub-door-label">Simulador</span>
            <span className="hub-door-sub">Practicá gratis</span>
          </Link>

          <Link
            href="/app?ref=copiloto"
            className="hub-door"
            onClick={() => track("hub_copilot_click")}
          >
            <span className="hub-door-label">Copiloto</span>
            <span className="hub-door-sub">En la entrevista real</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

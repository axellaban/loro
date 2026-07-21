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

// Icono de Pastilla 3D estilo Matrix (bicolor + brillo de cápsula)
function PillSvg({ type }: { type: "blue" | "red" }) {
  const isRed = type === "red";
  return (
    <svg
      width="44"
      height="24"
      viewBox="0 0 42 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ transform: "rotate(-25deg)", filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.5))" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pillGradLeftBlue" x1="0" y1="0" x2="0" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="50%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
        <linearGradient id="pillGradRightBlue" x1="0" y1="0" x2="0" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>

        <linearGradient id="pillGradLeftRed" x1="0" y1="0" x2="0" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="50%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>
        <linearGradient id="pillGradRightRed" x1="0" y1="0" x2="0" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>

      {/* Mitad izquierda de la cápsula */}
      <path
        d="M11 0 H21 V22 H11 A11 11 0 0 1 11 0 Z"
        fill={isRed ? "url(#pillGradLeftRed)" : "url(#pillGradLeftBlue)"}
      />
      {/* Mitad derecha de la cápsula */}
      <path
        d="M21 0 H31 A11 11 0 0 1 31 22 H21 V0 Z"
        fill={isRed ? "url(#pillGradRightRed)" : "url(#pillGradRightBlue)"}
      />
      {/* Costura divisoria central */}
      <line x1="21" y1="0" x2="21" y2="22" stroke="rgba(0,0,0,0.3)" strokeWidth="1" />

      {/* Brillo de gelatina en la parte superior */}
      <path
        d="M11 3 H31 A8 8 0 0 0 37 9 H5 A8 8 0 0 1 11 3 Z"
        fill="white"
        opacity="0.38"
      />
    </svg>
  );
}

// Hub minimal (Luhmann): un solo mensaje y dos puertas.
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

        <div className="hub-matrix-prompt">
          <span className="hub-matrix-tag">¿CUÁL TE TOMÁS?</span>
        </div>

        <div className="hub-doors-pills">
          <Link
            href="/simulador"
            className="hub-pill-btn hub-pill-blue"
            onClick={() => track("hub_practice_click")}
          >
            <span className="hub-pill-gloss" />
            <span className="hub-pill-inner">
              <PillSvg type="blue" />
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
            <span className="hub-pill-gloss" />
            <span className="hub-pill-inner">
              <PillSvg type="red" />
              <span className="hub-pill-label">Copiloto</span>
              <span className="hub-pill-sub">te acompaña durante tu entrevista en tiempo real</span>
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}

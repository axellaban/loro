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

// Mano estilo cartoon emergiendo desde abajo ofreciendo la pastilla
function HandSvg({ side }: { side: "left" | "right" }) {
  const isRight = side === "right";
  return (
    <div className="hub-morpheus-hand-wrap" aria-hidden="true">
      <svg
        width="100"
        height="90"
        viewBox="0 0 120 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: isRight ? "scaleX(-1)" : "none" }}
      >
        {/* Muñeca (emerge desde abajo) */}
        <rect x="30" y="75" width="55" height="40" rx="6" fill="#c4956a" stroke="#2d2017" strokeWidth="2.5" />

        {/* Palma */}
        <path
          d="M25 78 C 25 55 30 42 38 35 L 80 35 C 88 42 93 55 93 78 Z"
          fill="#d4a574"
          stroke="#2d2017"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Dedo índice (curvado hacia abajo) */}
        <path
          d="M38 35 C 36 28 34 18 35 10 C 36 4 42 2 46 6 C 49 10 49 22 48 32"
          fill="#d4a574"
          stroke="#2d2017"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dedo medio */}
        <path
          d="M48 32 C 48 24 47 12 48 5 C 49 -1 55 -2 58 3 C 61 8 60 20 59 30"
          fill="#d4a574"
          stroke="#2d2017"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dedo anular */}
        <path
          d="M59 30 C 60 22 60 12 62 6 C 64 0 70 0 72 5 C 74 10 72 22 70 32"
          fill="#d4a574"
          stroke="#2d2017"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Meñique */}
        <path
          d="M70 35 C 72 28 74 18 76 12 C 78 7 83 8 84 13 C 85 18 82 28 80 36"
          fill="#d4a574"
          stroke="#2d2017"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pulgar (costado izquierdo) */}
        <path
          d="M25 60 C 18 55 12 48 10 40 C 8 33 12 28 18 30 C 24 32 26 42 26 52"
          fill="#d4a574"
          stroke="#2d2017"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Líneas de los nudillos */}
        <path d="M 42 33 C 43 30 45 29 47 31" stroke="#b8875c" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M 53 30 C 54 27 56 26 58 28" stroke="#b8875c" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M 64 31 C 65 28 67 27 69 30" stroke="#b8875c" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M 74 35 C 75 32 77 32 79 34" stroke="#b8875c" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// Cápsula 3D realista idéntica a la imagen de referencia Matrix
function MatrixPill3D({ type }: { type: "blue" | "red" }) {
  const isRed = type === "red";
  const idSuffix = isRed ? "Red" : "Blue";

  return (
    <svg
      width="140"
      height="58"
      viewBox="0 0 140 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="hub-3d-pill-svg"
      aria-hidden="true"
    >
      <defs>
        <filter id={`pillShadow${idSuffix}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>

        <linearGradient id={`gelBody${idSuffix}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={isRed ? "#f87171" : "#38bdf8"} />
          <stop offset="30%" stopColor={isRed ? "#ef4444" : "#0284c7"} />
          <stop offset="75%" stopColor={isRed ? "#b91c1c" : "#0369a1"} />
          <stop offset="100%" stopColor={isRed ? "#7f1d1d" : "#075985"} />
        </linearGradient>
      </defs>

      {/* Sombra de cáustica de color sobre el suelo */}
      <ellipse
        cx="70"
        cy="52"
        rx="52"
        ry="6"
        fill={isRed ? "#ef4444" : "#0284c7"}
        opacity="0.55"
        filter={`url(#pillShadow${idSuffix})`}
      />

      {/* Cuerpo principal de la cápsula */}
      <rect
        x="15"
        y="10"
        width="110"
        height="38"
        rx="19"
        fill={`url(#gelBody${idSuffix})`}
        stroke={isRed ? "rgba(248, 113, 113, 0.6)" : "rgba(56, 189, 248, 0.6)"}
        strokeWidth="1.5"
      />

      {/* Refracción translúcida interna */}
      <rect
        x="22"
        y="14"
        width="96"
        height="30"
        rx="15"
        fill={isRed ? "#f87171" : "#38bdf8"}
        opacity="0.25"
      />

      {/* Costura divisoria central de la cápsula */}
      <line x1="68" y1="10" x2="68" y2="48" stroke={isRed ? "#7f1d1d" : "#0369a1"} strokeWidth="1.5" opacity="0.8" />
      <line x1="70" y1="10" x2="70" y2="48" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />

      {/* Reflejos de cristal tipo ventana (especular alto) */}
      <ellipse cx="55" cy="18" rx="28" ry="3" fill="white" opacity="0.85" />
      <path d="M 32 14 H 108 C 114 14 120 17 120 22 C 120 18 114 14 108 14 H 32 Z" fill="white" opacity="0.9" />

      {/* Borde de luz inferior */}
      <path
        d="M 30 44 C 50 47 90 47 110 44"
        stroke={isRed ? "#fee2e2" : "#e0f2fe"}
        strokeWidth="1.5"
        opacity="0.6"
        strokeLinecap="round"
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

        <div className="hub-doors-pills">
          <Link
            href="/simulador"
            className="hub-option-btn hub-option-blue"
            onClick={() => track("hub_practice_click")}
          >
            <span className="hub-glow-blue" />
            <div className="hub-pill-wrapper">
              <MatrixPill3D type="blue" />
              <HandSvg side="left" />
            </div>
            <span className="hub-option-label hub-label-blue">Simulador</span>
            <span className="hub-option-sub">practicá con un entrevistador muy simpático</span>
          </Link>

          <Link
            href="/app?ref=copiloto"
            className="hub-option-btn hub-option-red"
            onClick={() => track("hub_copilot_click")}
          >
            <span className="hub-glow-red" />
            <div className="hub-pill-wrapper">
              <MatrixPill3D type="red" />
              <HandSvg side="right" />
            </div>
            <span className="hub-option-label hub-label-red">Copiloto</span>
            <span className="hub-option-sub">te acompaña durante tu entrevista en tiempo real</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

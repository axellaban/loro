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

// Mano de Morfeo emergiendo de la oscuridad — palma abierta hacia arriba
function MorpheusHandSvg({ side }: { side: "left" | "right" }) {
  const isRight = side === "right";
  const id = isRight ? "R" : "L";
  return (
    <div className="hub-morpheus-hand-wrap" aria-hidden="true">
      <svg
        width="180"
        height="140"
        viewBox="0 0 200 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: isRight ? "scaleX(-1)" : "none" }}
      >
        <defs>
          {/* Gradiente principal de piel oscura cinematográfica */}
          <radialGradient id={`skin${id}`} cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#5a463a" />
            <stop offset="40%" stopColor="#3d2e25" />
            <stop offset="75%" stopColor="#1f1510" />
            <stop offset="100%" stopColor="#0a0705" />
          </radialGradient>

          {/* Rim light lateral dramático (iluminación de borde estilo Matrix) */}
          <linearGradient id={`rim${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(180,140,110,0.5)" />
            <stop offset="50%" stopColor="rgba(180,140,110,0)" />
            <stop offset="100%" stopColor="rgba(180,140,110,0.35)" />
          </linearGradient>

          {/* Luz especular cálida en el centro de la palma */}
          <radialGradient id={`palmLight${id}`} cx="50%" cy="45%" r="40%">
            <stop offset="0%" stopColor="rgba(255,220,190,0.35)" />
            <stop offset="100%" stopColor="rgba(255,220,190,0)" />
          </radialGradient>

          {/* Desvanecimiento a negro en la muñeca (emerge de la oscuridad) */}
          <linearGradient id={`fadeBlack${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="65%" stopColor="rgba(0,0,0,0)" />
            <stop offset="88%" stopColor="rgba(0,0,0,0.7)" />
            <stop offset="100%" stopColor="rgba(0,0,0,1)" />
          </linearGradient>

          {/* Sombra difusa */}
          <filter id={`handBlur${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Sombra proyectada oscura debajo de la mano */}
        <ellipse cx="100" cy="165" rx="65" ry="8" fill="rgba(0,0,0,0.6)" filter={`url(#handBlur${id})`} />

        {/* ====== MUÑECA Y ANTEBRAZO (emergiendo de la oscuridad) ====== */}
        <path
          d="M55 180 C 55 160 50 145 52 135 L 148 135 C 150 145 145 160 145 180 Z"
          fill={`url(#skin${id})`}
        />

        {/* ====== PALMA PRINCIPAL ====== */}
        <path
          d="M52 135 C 48 120 42 105 38 95 C 34 85 32 75 38 65
             C 42 58 48 60 50 68 C 53 76 55 88 56 95
             L 144 95
             C 145 88 147 76 150 68 C 152 60 158 58 162 65
             C 168 75 166 85 162 95 C 158 105 152 120 148 135
             Z"
          fill={`url(#skin${id})`}
          stroke="rgba(180,140,110,0.15)"
          strokeWidth="0.8"
        />

        {/* ====== DEDOS ====== */}
        {/* Pulgar (izquierdo) */}
        <path
          d="M38 95 C 30 85 22 70 18 58 C 14 48 16 38 24 36
             C 32 34 36 42 38 52 C 40 60 40 72 42 82"
          fill={`url(#skin${id})`}
          stroke="rgba(180,140,110,0.2)"
          strokeWidth="0.8"
        />

        {/* Dedo índice */}
        <path
          d="M56 95 C 54 82 50 60 48 42 C 46 28 50 16 58 14
             C 66 12 70 22 70 36 C 70 48 68 68 68 82"
          fill={`url(#skin${id})`}
          stroke="rgba(180,140,110,0.18)"
          strokeWidth="0.8"
        />

        {/* Dedo medio (el más largo) */}
        <path
          d="M78 90 C 76 74 74 48 73 30 C 72 16 76 4 84 2
             C 92 0 96 12 96 28 C 96 44 94 68 92 84"
          fill={`url(#skin${id})`}
          stroke="rgba(180,140,110,0.18)"
          strokeWidth="0.8"
        />

        {/* Dedo anular */}
        <path
          d="M102 90 C 102 74 102 50 103 34 C 104 20 108 10 116 10
             C 124 10 126 22 125 36 C 124 50 122 70 120 84"
          fill={`url(#skin${id})`}
          stroke="rgba(180,140,110,0.18)"
          strokeWidth="0.8"
        />

        {/* Meñique */}
        <path
          d="M132 95 C 134 82 138 64 140 50 C 142 38 144 28 150 28
             C 156 28 158 38 156 50 C 154 62 150 78 148 90"
          fill={`url(#skin${id})`}
          stroke="rgba(180,140,110,0.18)"
          strokeWidth="0.8"
        />

        {/* ====== RIM LIGHT (borde de luz dramático) ====== */}
        <path
          d="M38 95 C 30 85 22 70 18 58 C 14 48 16 38 24 36
             C 32 34 36 42 38 52"
          fill="none"
          stroke="rgba(200,160,130,0.5)"
          strokeWidth="1.5"
        />
        <path
          d="M162 65 C 168 75 166 85 162 95 C 158 105 152 120 148 135"
          fill="none"
          stroke="rgba(200,160,130,0.35)"
          strokeWidth="1.2"
        />

        {/* ====== PLIEGUES DE LA PALMA ====== */}
        <path d="M 55 98 C 70 112 100 118 140 108" stroke="rgba(0,0,0,0.5)" strokeWidth="2" strokeLinecap="round" />
        <path d="M 60 115 C 78 124 110 128 142 120" stroke="rgba(0,0,0,0.4)" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M 48 80 C 52 90 58 100 62 112" stroke="rgba(0,0,0,0.45)" strokeWidth="1.5" strokeLinecap="round" />

        {/* Pliegues entre dedos */}
        <path d="M 68 82 C 72 88 78 90 82 86" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M 92 84 C 96 88 102 88 106 84" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M 120 84 C 124 90 130 92 134 88" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" strokeLinecap="round" />

        {/* ====== LUZ ESPECULAR EN LA PALMA ====== */}
        <ellipse cx="100" cy="105" rx="36" ry="16" fill={`url(#palmLight${id})`} />

        {/* ====== VELO DE OSCURIDAD (fade to black en la muñeca) ====== */}
        <rect x="0" y="0" width="200" height="180" fill={`url(#fadeBlack${id})`} />
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
              <MorpheusHandSvg side="left" />
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
              <MorpheusHandSvg side="right" />
            </div>
            <span className="hub-option-label hub-label-red">Copiloto</span>
            <span className="hub-option-sub">te acompaña durante tu entrevista en tiempo real</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

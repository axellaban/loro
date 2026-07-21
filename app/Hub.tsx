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

// Mano de Morfeo — palma abierta hacia arriba, posición anatómica horizontal
function MorpheusHandSvg({ side }: { side: "left" | "right" }) {
  const isRight = side === "right";
  const id = isRight ? "R" : "L";
  return (
    <div className="hub-morpheus-hand-wrap" aria-hidden="true">
      <svg
        width="200"
        height="130"
        viewBox="0 0 260 170"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: isRight ? "scaleX(-1)" : "none" }}
      >
        <defs>
          {/* Piel oscura cinematográfica con iluminación cenital tenue */}
          <radialGradient id={`skin${id}`} cx="45%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#5c483c" />
            <stop offset="35%" stopColor="#3f2f26" />
            <stop offset="70%" stopColor="#221810" />
            <stop offset="100%" stopColor="#0c0806" />
          </radialGradient>

          {/* Luz cenital cálida en la palma */}
          <radialGradient id={`palmLight${id}`} cx="50%" cy="50%" r="45%">
            <stop offset="0%" stopColor="rgba(255,215,185,0.4)" />
            <stop offset="100%" stopColor="rgba(255,215,185,0)" />
          </radialGradient>

          {/* Fade a negro en la muñeca (emerge de la oscuridad) */}
          <linearGradient id={`fadeWrist${id}`} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="55%" stopColor="rgba(0,0,0,0)" />
            <stop offset="82%" stopColor="rgba(0,0,0,0.65)" />
            <stop offset="100%" stopColor="rgba(0,0,0,1)" />
          </linearGradient>
        </defs>

        {/* ====== MUÑECA / ANTEBRAZO entrando desde abajo-izquierda ====== */}
        <path
          d="M5 170 C 15 155 30 140 45 125 L 70 120 L 65 140 C 50 150 30 160 10 170 Z"
          fill={`url(#skin${id})`}
        />
        <path
          d="M0 170 L 25 150 C 38 138 50 128 60 122 L 75 118 L 68 145 C 50 155 28 165 5 170 Z"
          fill={`url(#skin${id})`}
        />

        {/* ====== PALMA ABIERTA (vista desde arriba, horizontal) ====== */}
        <path
          d="M60 122 C 65 110 72 95 80 85
             L 200 65
             C 210 62 215 68 212 78
             L 85 100
             C 82 108 75 118 70 125
             Z"
          fill={`url(#skin${id})`}
          stroke="rgba(180,145,115,0.12)"
          strokeWidth="0.8"
        />

        {/* Relleno de carne de la palma (volumen) */}
        <path
          d="M68 118 C 72 108 80 92 88 82
             L 190 66
             C 195 80 188 90 180 92
             L 82 108
             C 78 114 73 120 70 124 Z"
          fill={`url(#skin${id})`}
        />

        {/* ====== DEDOS (extendidos horizontalmente hacia la derecha) ====== */}

        {/* Dedo índice (arriba) */}
        <path
          d="M185 60 C 200 56 218 52 235 50
             C 248 48 254 54 250 62
             C 246 70 230 70 218 68
             C 206 66 195 66 188 68"
          fill={`url(#skin${id})`}
          stroke="rgba(180,145,115,0.15)"
          strokeWidth="0.7"
        />

        {/* Dedo medio (el más largo) */}
        <path
          d="M192 68 C 208 65 228 62 248 60
             C 258 59 260 66 256 73
             C 252 80 234 80 220 78
             C 208 76 198 76 192 77"
          fill={`url(#skin${id})`}
          stroke="rgba(180,145,115,0.15)"
          strokeWidth="0.7"
        />

        {/* Dedo anular */}
        <path
          d="M195 77 C 210 76 228 74 244 73
             C 254 72 256 79 252 85
             C 248 91 232 90 220 88
             C 210 86 200 86 195 86"
          fill={`url(#skin${id})`}
          stroke="rgba(180,145,115,0.15)"
          strokeWidth="0.7"
        />

        {/* Meñique */}
        <path
          d="M192 86 C 204 86 218 85 230 84
             C 240 83 242 90 238 95
             C 234 100 220 98 210 96
             C 202 94 196 94 192 94"
          fill={`url(#skin${id})`}
          stroke="rgba(180,145,115,0.15)"
          strokeWidth="0.7"
        />

        {/* Pulgar (abajo, separado) */}
        <path
          d="M80 95 C 88 100 100 108 112 115
             C 120 120 118 128 110 130
             C 102 132 92 126 84 118
             C 78 112 74 106 72 100"
          fill={`url(#skin${id})`}
          stroke="rgba(180,145,115,0.2)"
          strokeWidth="0.7"
        />

        {/* ====== RIM LIGHT (iluminación de borde cinematográfica) ====== */}
        <path
          d="M235 50 C 248 48 254 54 250 62"
          fill="none" stroke="rgba(210,175,145,0.55)" strokeWidth="1.5" strokeLinecap="round"
        />
        <path
          d="M248 60 C 258 59 260 66 256 73"
          fill="none" stroke="rgba(210,175,145,0.5)" strokeWidth="1.3" strokeLinecap="round"
        />
        <path
          d="M244 73 C 254 72 256 79 252 85"
          fill="none" stroke="rgba(210,175,145,0.45)" strokeWidth="1.2" strokeLinecap="round"
        />

        {/* ====== PLIEGUES DE LA PALMA ====== */}
        <path d="M 88 86 C 120 88 160 82 188 74" stroke="rgba(0,0,0,0.5)" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M 80 96 C 110 100 150 94 185 85" stroke="rgba(0,0,0,0.4)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M 75 108 C 95 112 125 108 155 98" stroke="rgba(0,0,0,0.35)" strokeWidth="1.3" strokeLinecap="round" />

        {/* Pliegues entre dedos */}
        <path d="M 188 68 C 190 72 192 74 194 72" stroke="rgba(0,0,0,0.4)" strokeWidth="1" strokeLinecap="round" />
        <path d="M 192 77 C 194 80 196 82 197 80" stroke="rgba(0,0,0,0.4)" strokeWidth="1" strokeLinecap="round" />
        <path d="M 195 86 C 194 90 193 92 194 91" stroke="rgba(0,0,0,0.35)" strokeWidth="1" strokeLinecap="round" />

        {/* ====== LUZ ESPECULAR EN LA PALMA (donde reposa la cápsula) ====== */}
        <ellipse cx="140" cy="84" rx="40" ry="14" fill={`url(#palmLight${id})`} />

        {/* ====== VELO DE OSCURIDAD (fade to black en la muñeca) ====== */}
        <rect x="0" y="0" width="260" height="170" fill={`url(#fadeWrist${id})`} />
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

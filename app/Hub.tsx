"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ParrotSvg } from "./lib/parrot";
import { IaFlag } from "./lib/BrandLogo";
import { track } from "./lib/track";

// Palabras que rotan en la 1ra palabra del título (efecto swap).
const HERO_WORDS = ["Loreá", "crackeá", "hackeá", "pasá"];

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

// Rama de laurel dorada, como la que flanquea los "No.1" de Binance. Es una
// sola mitad; el lado derecho es la misma rama espejada con CSS.
function Laurel({ mirrored }: { mirrored?: boolean }) {
  return (
    <svg
      width="26"
      height="60"
      viewBox="0 0 26 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="hub-laurel"
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        d="M22 2C16 10 13 18 12.5 30C13 42 16 50 22 58"
        stroke="#fbbf24"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.9"
      />
      {[6, 14, 22, 30, 38, 46, 54].map((y, i) => (
        <ellipse
          key={y}
          cx={i % 2 === 0 ? 9 : 7}
          cy={y}
          rx="7"
          ry="3.4"
          fill="#fbbf24"
          transform={`rotate(${i % 2 === 0 ? -28 : 28} ${i % 2 === 0 ? 9 : 7} ${y})`}
          opacity={0.55 + (i % 2) * 0.25}
        />
      ))}
    </svg>
  );
}

// ----- Contador de "entrevistas superadas" (estilo Binance) -----
// Es cosmético, no un conteo real: no hay backend detrás. La sensación de
// "vivo" sale de dos cosas: arranca en un número base y sube solito cada
// tanto mientras la pestaña está abierta, Y lo último que mostró queda en
// localStorage con su hora, así que si volvés más tarde el número "se puso al
// día" con el tiempo que pasó (con un tope, para que no salte a algo absurdo
// si volvés después de mucho).
const STAT_KEY = "loreado:statCounter:v1";
const STAT_BASE = 4467;
const STAT_MS_PER_TICK = 50_000; // ritmo promedio de una "entrevista" más
const STAT_CATCHUP_CAP = 400;

function StatsCounter() {
  const [n, setN] = useState(STAT_BASE);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    const persist = (v: number) => {
      try {
        localStorage.setItem(STAT_KEY, JSON.stringify({ value: v, ts: Date.now() }));
      } catch {}
    };

    let stored = STAT_BASE;
    let lastTs = Date.now();
    try {
      const raw = localStorage.getItem(STAT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.value === "number" && typeof parsed.ts === "number") {
          stored = parsed.value;
          lastTs = parsed.ts;
        }
      }
    } catch {}

    const elapsedTicks = Math.floor((Date.now() - lastTs) / STAT_MS_PER_TICK);
    const start = Math.max(STAT_BASE, stored + Math.min(elapsedTicks, STAT_CATCHUP_CAP));
    setN(start);
    persist(start);

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (cancelled) return;
      setN((prev) => {
        const next = prev + 1;
        persist(next);
        return next;
      });
      setBump((b) => b + 1);
      // Ritmo variable (70%-130% del promedio) para que no se note mecánico.
      timer = setTimeout(tick, STAT_MS_PER_TICK * (0.7 + Math.random() * 0.6));
    };
    timer = setTimeout(tick, STAT_MS_PER_TICK * (0.7 + Math.random() * 0.6));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="hub-stats">
      <div className="hub-stats-headline">
        <span className="hub-stats-num" key={bump}>
          +{n.toLocaleString("en-US")}
        </span>
        <span className="hub-stats-h">ENTREVISTAS</span>
        <span className="hub-stats-h">SUPERADAS CON ÉXITO</span>
      </div>
      <p className="hub-stats-tag">#1 Copiloto de Entrevistas con IA de América Latina.</p>
      <div className="hub-stats-mini">
        <div className="hub-stats-mini-item">
          <Laurel />
          <div className="hub-stats-mini-text">
            <span className="hub-stats-mini-num">&lt; 1 segundo</span>
            <span className="hub-stats-mini-label">de tiempo de respuesta</span>
          </div>
          <Laurel mirrored />
        </div>
        <div className="hub-stats-mini-item">
          <Laurel />
          <div className="hub-stats-mini-text">
            <span className="hub-stats-mini-num">0</span>
            <span className="hub-stats-mini-label">Estrés frente a los reclutadores</span>
          </div>
          <Laurel mirrored />
        </div>
      </div>
    </div>
  );
}

// Hub minimal (Luhmann): un solo mensaje y dos puertas.
export default function Hub() {
  const [wordIdx, setWordIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setWordIdx((i) => (i + 1) % HERO_WORDS.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  // Resaltado dibujado a mano (rough-notation), el mismo efecto del sitio A13I,
  // sobre "asistente de IA / en tiempo real". Se dibuja al montar y se recalcula
  // en resize (el SVG se posiciona según el layout).
  const hlRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let cancelled = false;
    let annotation: { show: () => void; remove: () => void } | null = null;
    let onResize: (() => void) | null = null;
    void import("rough-notation").then(({ annotate }) => {
      if (cancelled || !hlRef.current) return;
      const make = (animate: boolean) => {
        const el = hlRef.current;
        if (!el) return;
        annotation?.remove();
        annotation = annotate(el, {
          type: "highlight",
          color: "rgba(163,230,53,0.5)",
          multiline: true,
          padding: 2,
          animationDuration: animate ? 900 : 0,
          iterations: 2,
        });
        annotation.show();
      };
      const t = setTimeout(() => !cancelled && make(true), 500);
      onResize = () => make(false);
      window.addEventListener("resize", onResize);
      if (cancelled) clearTimeout(t);
    });
    return () => {
      cancelled = true;
      annotation?.remove();
      if (onResize) window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="hub">
      <main className="hub-main">
        <Link href="/" aria-label="Ir al inicio" className="hub-brand" style={{ textDecoration: "none" }}>
          <ParrotSvg size={28} />
          <span className="hub-brand-text">Loreado</span>
          <IaFlag w={29} />
        </Link>

        <h1 className="hub-h1">
          <span key={wordIdx} className="hub-h1-swap">
            {HERO_WORDS[wordIdx]}
          </span>{" "}
          todas las
          <br />
          entrevistas con el
          <br />
          <span ref={hlRef} className="hub-h1-hl">
            asistente de IA
            <br />
            en tiempo real
          </span>
        </h1>

        <div className="hub-doors-pills">
          <Link
            href="/simulador"
            className="hub-option-btn hub-option-blue"
            onClick={() => track("hub_practice_click")}
          >
            <span className="hub-glow-blue" />
            <div className="hub-pill-wrapper">
              <MatrixPill3D type="blue" />
            </div>
            <span className="hub-option-label hub-label-blue">Simulador</span>
            <span className="hub-option-sub">Simulacro Sprint (5 preguntas) con IA y feedback al instante.</span>
          </Link>

          <Link
            href="/app?ref=copiloto"
            className="hub-option-btn hub-option-red"
            onClick={() => track("hub_copilot_click")}
          >
            <span className="hub-glow-red" />
            <div className="hub-pill-wrapper">
              <MatrixPill3D type="red" />
            </div>
            <span className="hub-option-label hub-label-red">Copiloto</span>
            <span className="hub-option-sub">Te sopla las respuestas exactas. 100% indetectable en vivo.</span>
          </Link>
        </div>

        <StatsCounter />
      </main>
    </div>
  );
}

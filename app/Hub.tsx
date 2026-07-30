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

// Rama de laurel dorada, como la que flanquea los "No.1" de Binance: UNA sola
// curva en forma de paréntesis, con las hojas ensartadas a lo largo de esa
// curva y apuntando siempre hacia afuera (radial al centro del arco) — no un
// tallo con hojas de a pares como en la versión anterior, que no se parecía
// en nada a la referencia.
const LAUREL_R = 27;
const LAUREL_CX = 48;
const LAUREL_CY = 40;
const LAUREL_ANGLE_START = 262; // grados, convención matemática (0=derecha, 90=arriba)
const LAUREL_ANGLE_END = 98;
const LAUREL_COUNT = 15;

function laurelPoint(t: number) {
  const deg = LAUREL_ANGLE_START + (LAUREL_ANGLE_END - LAUREL_ANGLE_START) * t;
  const rad = (deg * Math.PI) / 180;
  // Punto sobre el arco (dónde se prende la hoja) y dirección radial hacia
  // afuera desde ahí, en pantalla (y crece hacia abajo).
  const baseX = LAUREL_CX + LAUREL_R * Math.cos(rad);
  const baseY = LAUREL_CY - LAUREL_R * Math.sin(rad);
  const dx = Math.cos(rad);
  const dy = -Math.sin(rad);
  // Ángulo de rotación SVG (sentido horario desde "arriba") que apunta la
  // hoja hacia afuera, en la misma dirección radial del punto.
  const rot = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return { baseX, baseY, rot };
}

// Hoja real (no una almendra simétrica): base redondeada donde se prende al
// tallo, afinándose hasta una punta bien marcada, con su vena central — como
// la referencia, no como óvalos girados.
const LEAF_D = "M0 0C3.4 -1.6 4 -6 2.6 -10.5C1.7 -13.4 0.6 -15 0 -16C-0.6 -15 -1.7 -13.4 -2.6 -10.5C-4 -6 -3.4 -1.6 0 0Z";

function Laurel({ mirrored }: { mirrored?: boolean }) {
  const start = laurelPoint(0);
  const end = laurelPoint(1);
  const leaves = Array.from({ length: LAUREL_COUNT }, (_, i) => {
    const t = i / (LAUREL_COUNT - 1);
    const edge = Math.min(t, 1 - t) * 2.2; // 0 en las puntas, tope 1 en el medio
    const scale = 0.6 + 0.4 * Math.min(edge, 1);
    return { ...laurelPoint(t), scale };
  });
  return (
    <svg
      width="42"
      height="46"
      viewBox="0 0 90 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="hub-laurel"
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        d={`M${start.baseX} ${start.baseY} A${LAUREL_R} ${LAUREL_R} 0 0 1 ${end.baseX} ${end.baseY}`}
        stroke="#b8790a"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.75"
      />
      {leaves.map((l, i) => (
        <g key={i} transform={`translate(${l.baseX} ${l.baseY}) rotate(${l.rot}) scale(${l.scale})`}>
          <path d={LEAF_D} fill="#fbbf24" stroke="#b8790a" strokeWidth="0.35" />
          <line x1="0" y1="-1.5" x2="0" y2="-14" stroke="#b8790a" strokeWidth="0.35" opacity="0.6" />
        </g>
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
// Tiene que VERSE subir mientras alguien mira la página (de a 1, de a 2, cada
// pocos segundos), no una vez cada rato — si no, en una visita normal nunca
// se lo ve moverse y pierde todo el efecto de "contador vivo".
const STAT_MS_PER_TICK = 2_200;
const STAT_CATCHUP_CAP = 300;

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
      const step = Math.random() < 0.7 ? 1 : 2; // de a 1, a veces de a 2
      setN((prev) => {
        const next = prev + step;
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

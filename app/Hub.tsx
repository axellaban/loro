"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ParrotSvg } from "./lib/parrot";
import { IaFlag } from "./lib/BrandLogo";
import { track } from "./lib/track";

// Palabras que rotan en la 1ra palabra del título (efecto swap).
const HERO_WORDS = ["Loreá", "crackeá", "hackeá", "pasá"];

/**
 * Resaltador dibujado a mano (rough-notation), el efecto del sitio A13I.
 * Devuelve el ref que hay que colgar del <span> a resaltar.
 *
 * Dos cosas que hay que respetar o el resaltado sale corrido:
 *
 * 1. rough-notation mide el ELEMENTO, no el texto. Si el span es un flex item
 *    (que por default se estira al ancho del contenedor) el resaltado sale
 *    mucho más ancho que las letras. El span tiene que ser INLINE dentro de un
 *    bloque de texto normal, como en el <h1> del hero.
 *
 * 2. El trazo se dibuja UNA vez, con coordenadas fijas del momento en que se
 *    dibujó. Si después el texto se mueve, el trazo se queda donde estaba. Y
 *    acá se mueve: el hero usa 100dvh, que en Safari mobile cambia de alto
 *    cuando se colapsa la barra de URL al scrollear. Por eso se vigila la
 *    geometría real del span y se redibuja cuando cambia de verdad (no en
 *    cada scroll: solo si la posición o el tamaño cambiaron).
 */
function useHandHighlight() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let cancelled = false;
    let annotation: { show: () => void; remove: () => void } | null = null;
    let cleanupWatchers: (() => void) | null = null;

    void import("rough-notation").then(({ annotate }) => {
      if (cancelled || !ref.current) return;

      // Firma de la geometría en coordenadas de DOCUMENTO (no de viewport):
      // así el scroll por sí solo no cuenta como movimiento, pero un cambio
      // real de layout sí.
      const geom = () => {
        const el = ref.current;
        if (!el) return "";
        const r = el.getBoundingClientRect();
        return [
          Math.round(r.width),
          Math.round(r.height),
          Math.round(r.left + window.scrollX),
          Math.round(r.top + window.scrollY),
        ].join("|");
      };

      let last = "";
      const draw = (animate: boolean) => {
        const el = ref.current;
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
        last = geom();
      };

      let raf = 0;
      const sync = () => {
        raf = 0;
        if (cancelled) return;
        // Solo redibuja si el texto se movió o cambió de tamaño de verdad.
        if (geom() !== last) draw(false);
      };
      const onGeom = () => {
        if (raf) return;
        raf = requestAnimationFrame(sync);
      };

      const t = setTimeout(() => !cancelled && draw(true), 500);

      const ro = new ResizeObserver(onGeom);
      ro.observe(document.documentElement);
      if (ref.current) ro.observe(ref.current);
      window.addEventListener("resize", onGeom);
      window.addEventListener("scroll", onGeom, { passive: true });
      // Las webfonts cambian el ancho del texto al terminar de cargar.
      void document.fonts?.ready.then(onGeom).catch(() => {});

      cleanupWatchers = () => {
        clearTimeout(t);
        if (raf) cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener("resize", onGeom);
        window.removeEventListener("scroll", onGeom);
      };
      if (cancelled) cleanupWatchers();
    });

    return () => {
      cancelled = true;
      annotation?.remove();
      cleanupWatchers?.();
    };
  }, []);
  return ref;
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

// Rama de laurel dorada, tal cual la referencia nueva: UNA sola rama que se
// curva de abajo hacia arriba (con un pequeño rulo en la punta), con hojas de
// a PARES a los costados del tallo —no ensartadas radialmente sobre un arco
// como en la versión anterior—.
const LAUREL_STEM: [number, number][] = [
  [58, 148],
  [8, 108],
  [14, 52],
  [46, 8],
];
// Rulo de la punta: un pequeño hook que se curva sobre sí mismo, como en la
// referencia.
const LAUREL_CURL = "C58 4 66 8 62 16C59 22 51 21 47 15";

function bezierPoint(pts: [number, number][], t: number) {
  const [p0, p1, p2, p3] = pts;
  const mt = 1 - t;
  const x = mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0];
  const y = mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1];
  const dx = 3 * mt ** 2 * (p1[0] - p0[0]) + 6 * mt * t * (p2[0] - p1[0]) + 3 * t ** 2 * (p3[0] - p2[0]);
  const dy = 3 * mt ** 2 * (p1[1] - p0[1]) + 6 * mt * t * (p2[1] - p1[1]) + 3 * t ** 2 * (p3[1] - p2[1]);
  return { x, y, dx, dy };
}

// Hoja real (base redondeada donde se prende al tallo, afinándose hasta una
// punta marcada, con su vena central).
const LEAF_D = "M0 0C3.4 -1.6 4 -6 2.6 -10.5C1.7 -13.4 0.6 -15 0 -16C-0.6 -15 -1.7 -13.4 -2.6 -10.5C-4 -6 -3.4 -1.6 0 0Z";
const LEAF_PAIR_COUNT = 9;

function Laurel({ mirrored }: { mirrored?: boolean }) {
  const [p0] = LAUREL_STEM;
  const p3 = LAUREL_STEM[3];
  const pairs = Array.from({ length: LEAF_PAIR_COUNT }, (_, i) => {
    // Arrancan un poco después de la base y terminan antes de la punta: ahí
    // las hojas quedan más sueltas, como en la referencia.
    const t = 0.08 + (i / (LEAF_PAIR_COUNT - 1)) * 0.82;
    const { x, y, dx, dy } = bezierPoint(LAUREL_STEM, t);
    const len = Math.hypot(dx, dy) || 1;
    const tanX = dx / len;
    const tanY = dy / len;
    // Normal (perpendicular al tallo) — cada hoja del par usa un lado.
    const norX = -tanY;
    const norY = tanX;
    // Las hojas no salen perpendiculares puras: se inclinan un poco hacia la
    // punta, como crecen de verdad.
    const dirX = norX * 0.85 + tanX * 0.4;
    const dirY = norY * 0.85 + tanY * 0.4;
    const rot = (Math.atan2(dirX, -dirY) * 180) / Math.PI;
    const dirX2 = -norX * 0.85 + tanX * 0.4;
    const dirY2 = -norY * 0.85 + tanY * 0.4;
    const rot2 = (Math.atan2(dirX2, -dirY2) * 180) / Math.PI;
    const scale = 0.55 + 0.55 * Math.sin(Math.PI * Math.min(t / 0.85, 1));
    return { x, y, rot, rot2, scale };
  });
  return (
    <svg
      width="44"
      height="75"
      viewBox="0 0 72 158"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="hub-laurel"
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        d={`M${p0[0]} ${p0[1]}C${LAUREL_STEM[1][0]} ${LAUREL_STEM[1][1]} ${LAUREL_STEM[2][0]} ${LAUREL_STEM[2][1]} ${p3[0]} ${p3[1]}${LAUREL_CURL}`}
        stroke="#4d7c0f"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
      {pairs.map((l, i) => (
        <g key={i}>
          <g transform={`translate(${l.x} ${l.y}) rotate(${l.rot}) scale(${l.scale})`}>
            <path d={LEAF_D} fill="#a3e635" stroke="#4d7c0f" strokeWidth="0.4" />
            <line x1="0" y1="-1.5" x2="0" y2="-14" stroke="#4d7c0f" strokeWidth="0.4" opacity="0.6" />
          </g>
          <g transform={`translate(${l.x} ${l.y}) rotate(${l.rot2}) scale(${l.scale})`}>
            <path d={LEAF_D} fill="#a3e635" stroke="#4d7c0f" strokeWidth="0.4" />
            <line x1="0" y1="-1.5" x2="0" y2="-14" stroke="#4d7c0f" strokeWidth="0.4" opacity="0.6" />
          </g>
        </g>
      ))}
    </svg>
  );
}

// Un mini-stat (laurel + número + etiqueta), con feedback táctil al tocarlo:
// se usan Pointer Events en vez de :active porque en iOS Safari :active no
// dispara en un <div> común sin un handler de click/touch enganchado — con
// pointerdown/up/leave el efecto anda igual en mouse, touch y stylus.
function MiniStat({ value, label }: { value: string; label: string }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      className={`hub-stats-mini-item${pressed ? " hub-stats-mini-item-pressed" : ""}`}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
    >
      <Laurel />
      <div className="hub-stats-mini-text">
        <span className="hub-stats-mini-num">{value}</span>
        <span className="hub-stats-mini-label">{label}</span>
      </div>
      <Laurel mirrored />
    </div>
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
  const hlRef = useHandHighlight();

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

    // Espera hasta el próximo "evento" con distribución exponencial (la
    // misma que describe llegadas independientes al azar, tipo "cada tanto
    // termina una entrevista en algún lado"): la mayoría de las esperas son
    // cortas, pero de vez en cuando hay una pausa más larga y a veces dos
    // eventos casi seguidos — así se nota vivo en vez de metronómico.
    const nextDelay = () => -STAT_MS_PER_TICK * Math.log(1 - Math.random() * 0.98);
    // Tamaño del salto: casi siempre 1, a veces 2, rara vez 3 (como cuando
    // varias entrevistas terminan casi juntas).
    const nextStep = () => {
      const r = Math.random();
      if (r < 0.62) return 1;
      if (r < 0.92) return 2;
      return 3;
    };

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (cancelled) return;
      setN((prev) => {
        const next = prev + nextStep();
        persist(next);
        return next;
      });
      setBump((b) => b + 1);
      timer = setTimeout(tick, nextDelay());
    };
    timer = setTimeout(tick, nextDelay());
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="hub-stats">
      {/* Bloque de texto normal con <br>, NO un flex column de spans: el
          resaltado a mano mide el elemento, y un flex item se estira al ancho
          del contenedor (por eso antes salía mucho más ancho que las letras).
          Así queda igual que el <h1> del hero, donde el efecto siempre anduvo. */}
      <div className="hub-stats-headline">
        <span className="hub-stats-num" key={bump}>
          +{n.toLocaleString("en-US")}
        </span>
        <br />
        ENTREVISTAS
        <br />
        <span ref={hlRef} className="hub-stats-hl">
          SUPERADAS CON ÉXITO
        </span>
      </div>
      <p className="hub-stats-tag">#1 Copiloto de Entrevistas con IA de América Latina.</p>
      <div className="hub-stats-mini">
        <MiniStat value="< 1 segundo" label="de tiempo de respuesta" />
        <MiniStat value="0" label="Estrés frente a los reclutadores" />
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

  const hlRef = useHandHighlight();

  return (
    <div className="hub">
      <main className="hub-main">
        {/* El hero (logo + título + pastillas) ocupa la pantalla completa y
            se centra en ella, exactamente como antes de agregar el contador:
            eso NO puede cambiar. El contador va DESPUÉS, fuera de este
            bloque, así que solo lo ve quien hace scroll — no le come nada
            de aire al hero. */}
        <div className="hub-hero">
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
        </div>

        <StatsCounter />
      </main>
    </div>
  );
}

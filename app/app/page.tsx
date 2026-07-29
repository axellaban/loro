"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { track, identify } from "../lib/track";
import { BrandLogo } from "../lib/BrandLogo";
import { extractSentences } from "../simulador/tts";
import { MODELS, VISIBLE_MODELS, DEFAULT_MODEL_ID, isSelectable } from "../lib/models";
import { ProviderIcon } from "../lib/ProviderIcon";
import { looksLikeQuestion } from "../lib/question";
import CallSessions from "./CallSessions";
import { loadSessions, saveSession, type CallSession } from "../lib/sessions";
import { rememberEmail, savedEmail } from "../lib/email";
import { usePass, storedPassToken, type ActivePass } from "../lib/passClient";
import { PASS_HEADER, fmtPassExpiry } from "../lib/pass";

// Recorta el buffer acumulado a lo que se MUESTRA en la tarjeta "Pregunta":
// las últimas 1-2 oraciones. Si la última ya es una pregunta cerrada (termina
// en "?") alcanza con esa; si no, mostramos las 2 últimas (cubre preguntas
// armadas en dos frases o pedidos sin signo, ej. "Contame sobre…"). Solo afecta
// el display: a la IA se le sigue mandando el contexto completo.
function lastQuestions(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const { complete, rest } = extractSentences(t + " ");
  const chunks = [...complete, rest].map((s) => s.trim()).filter(Boolean);
  if (chunks.length === 0) return t;
  const last = chunks[chunks.length - 1];
  const take = /[?？]\s*$/.test(last) ? 1 : 2;
  return chunks.slice(-take).join(" ");
}

type Status = "idle" | "connecting" | "live" | "error";
type Mode = "mic" | "tab";
// `ts` es la hora en que se oyó: se muestra bajo cada burbuja del transcript.
type Line = { id: number; text: string; final: boolean; ts: number };
type Feedback = "up" | "down" | null;
type Answer = { id: number; question: string; text: string; done: boolean; ts: number; feedback: Feedback };

// Cuenta regresiva de la sesión, mm:ss. Con solo los minutos ("5 mins") la
// píldora se quedaba quieta un minuto entero y parecía trabada.
/** "02:10 p.m." — la hora bajo cada línea del transcript. */
function fmtHora(ts: number): string {
  const d = new Date(ts);
  const h24 = d.getHours();
  const h = h24 % 12 || 12;
  return `${String(h).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${
    h24 < 12 ? "a.m." : "p.m."
  }`;
}

function fmtCountdown(secs: number): string {
  const s = Math.max(0, secs);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString("es-AR", { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

// Ícono "mágico" (sparkle / auto-awesome) del botón de respuesta, como Parakeet.
function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l1.9 4.9 4.9 1.9-4.9 1.9L12 16l-1.9-4.8L5.2 9.3l4.9-1.9L12 2.5z" />
      <path d="M18.5 14.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3z" />
    </svg>
  );
}

// Iconos de los campos de contexto (estilo Parakeet: outline al lado del label).
const fieldIconProps = {
  width: 13,
  height: 13,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
function BriefcaseIcon() {
  return (
    <svg {...fieldIconProps}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg {...fieldIconProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h8" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg {...fieldIconProps}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function ThumbUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a2.5 2.5 0 0 1 3 3z" />
    </svg>
  );
}
function ThumbDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a2.5 2.5 0 0 1-3-3z" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

// Iconos del selector de tipo de sesión: outline, al lado del título de cada
// tarjeta, en el tamaño del texto (como la referencia de Parakeet).
const stypeIconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function CardIcon() {
  return (
    <svg {...stypeIconProps}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19" />
    </svg>
  );
}

function ClockBigIcon() {
  return (
    <svg {...stypeIconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg {...stypeIconProps}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

/** Mundo, para "resto del mundo". Hay otro GlobeIcon más chico para el menú. */
function WorldIcon() {
  return (
    <svg {...stypeIconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
    </svg>
  );
}

/** Banderita, para la opción de Argentina. */
function BannerIcon() {
  return (
    <svg {...stypeIconProps}>
      <path d="M5 21V4M5 5h12l-2 3.5L17 12H5" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}
function AaIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 18 7.5 6l4.5 12" />
      <path d="M4.6 14h5.8" />
      <path d="M20 18v-5.2a2.8 2.8 0 0 0-5.2-1.4" />
      <path d="M20 15.4c-3.6 0-5.2.7-5.2 2 0 .9.8 1.6 2 1.6 1.8 0 3.2-1.2 3.2-2.6Z" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}
function CheckMarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12.5 9 17.5 20 6.5" />
    </svg>
  );
}

// Tamaños del texto de la respuesta (mismos seis escalones que Parakeet).
// El valor se aplica como CSS var --answer-size sobre .answer-card-text.
const ANSWER_SIZES = [
  { id: "xs", label: "Extra chico", px: 13 },
  { id: "s", label: "Chico", px: 15 },
  { id: "m", label: "Normal", px: 16.5 },
  { id: "l", label: "Grande", px: 19 },
  { id: "xl", label: "Extra grande", px: 22 },
  { id: "xxl", label: "Enorme", px: 26 },
] as const;
type AnswerSizeId = (typeof ANSWER_SIZES)[number]["id"];
const DEFAULT_ANSWER_SIZE: AnswerSizeId = "m";

// Pausa que tiene que sostener el entrevistador para que la respuesta
// automática se dispare (las pausas cortas dentro de una pregunta no cuentan).
const AUTO_ANSWER_DELAY_MS = 1400;
function answerSizePx(id: string): number {
  return (ANSWER_SIZES.find((s) => s.id === id) || ANSWER_SIZES[2]).px;
}

const MENU_LANGS: Array<{ id: Lang; label: string }> = [
  { id: "es", label: "Español" },
  { id: "en", label: "English" },
];

// Menú de sesión del header (los tres puntitos), con el mismo diseño de dos
// niveles de Parakeet: las filas del menú quedan visibles y el submenú aparece
// como una tarjeta debajo de la fila elegida.
function SessionMenu({
  lang,
  onLang,
  sizeId,
  onSize,
  autoAnswer,
  onAutoAnswer,
}: {
  lang: Lang;
  onLang: (l: Lang) => void;
  sizeId: AnswerSizeId;
  onSize: (id: AnswerSizeId) => void;
  autoAnswer: boolean;
  onAutoAnswer: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"root" | "size" | "lang">("root");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // Al cerrar, la próxima apertura arranca de nuevo en el menú principal.
  useEffect(() => {
    if (!open) setView("root");
  }, [open]);

  const langLabel = MENU_LANGS.find((l) => l.id === lang)?.label || "";

  return (
    <div className="sess-menu" ref={ref}>
      <button
        type="button"
        className="sess-menu-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Opciones de la sesión"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <DotsIcon />
      </button>
      {open && (
        <div className="sess-panel" role="menu">
          <div className="sess-panel-title">Sesión</div>

          <button
            type="button"
            className={`sess-row ${view === "size" ? "sess-row-active" : ""}`}
            onClick={() => setView(view === "size" ? "root" : "size")}
          >
            <span className="sess-row-icon"><AaIcon /></span>
            <span className="sess-row-label">Tamaño del texto</span>
            <span className="sess-row-chevron"><ChevronRightIcon /></span>
          </button>
          {view === "size" && (
            <div className="sess-sub">
              {ANSWER_SIZES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`sess-sub-row ${s.id === sizeId ? "sess-sub-row-sel" : ""}`}
                  onClick={() => onSize(s.id)}
                >
                  <span className="sess-sub-aa" style={{ fontSize: s.px }}>Aa</span>
                  <span className="sess-sub-label">{s.label}</span>
                  {s.id === sizeId && <span className="sess-sub-check"><CheckMarkIcon /></span>}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className={`sess-row ${view === "lang" ? "sess-row-active" : ""}`}
            onClick={() => setView(view === "lang" ? "root" : "lang")}
          >
            <span className="sess-row-icon"><GlobeIcon /></span>
            <span className="sess-row-label">Idioma</span>
            <span className="sess-row-value">{langLabel}</span>
            <span className="sess-row-chevron"><ChevronRightIcon /></span>
          </button>
          {view === "lang" && (
            <div className="sess-sub">
              {MENU_LANGS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`sess-sub-row ${l.id === lang ? "sess-sub-row-sel" : ""}`}
                  onClick={() => onLang(l.id)}
                >
                  <span className="sess-sub-label sess-sub-label-lang">{l.label}</span>
                  {l.id === lang && <span className="sess-sub-check"><CheckMarkIcon /></span>}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className="sess-row sess-row-toggle"
            role="switch"
            aria-checked={autoAnswer}
            onClick={() => onAutoAnswer(!autoAnswer)}
          >
            <span className="sess-row-icon"><SparkleIcon /></span>
            <span className="sess-row-label">Respuesta automática</span>
            <span className={`sess-switch ${autoAnswer ? "sess-switch-on" : ""}`} aria-hidden="true">
              <span className="sess-switch-knob" />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

// Tooltip de ayuda (ⓘ) tap-to-toggle, apto mobile (el title nativo no aparece
// al tocar en el celular).
function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <span className="info-tip" ref={ref}>
      <button
        type="button"
        className="info-tip-btn"
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        aria-label="Ayuda"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      </button>
      {open && <span className="info-bubble">{text}</span>}
    </span>
  );
}

// Tira en vivo: muestra las últimas palabras oídas y resalta la más reciente
// (cue de "te estoy escuchando ahora"), como el marcado de Parakeet.
function ListenText({ text }: { text: string }) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  // El contenedor trunca a la izquierda (direction: rtl) para que la palabra
  // más reciente quede siempre visible a la derecha; el <bdi> mantiene el orden
  // de lectura normal (izq→der) del texto latino.
  if (words.length === 0) return <bdi>escuchando…</bdi>;
  const last = words[words.length - 1];
  const head = words.slice(Math.max(0, words.length - 9), words.length - 1).join(" ");
  return (
    <bdi>
      {head && <>{head} </>}
      <span className="active-word">{last}</span>
    </bdi>
  );
}

// Dropdown custom (con icono, tag y badge) — el <select> nativo no lo permite.
type DDOption = {
  id: string;
  label: string;
  /** Versión abreviada para la píldora cerrada. Si falta, se usa `label`. */
  short?: string;
  icon?: ReactNode;
  tag?: string;
  badge?: string;
};
function Dropdown({
  value,
  options,
  onChange,
  disabled,
  ariaLabel,
  alignRight,
}: {
  value: string;
  options: DDOption[];
  onChange: (id: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  alignRight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);
  const current = options.find((o) => o.id === value) || options[0];
  return (
    <div className="dd" ref={ref}>
      <button
        type="button"
        className="dd-trigger"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="dd-trigger-main">
          {current?.icon}
          <span className="dd-trigger-label">{current?.short ?? current?.label}</span>
        </span>
        <span className="dd-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className={`dd-menu ${alignRight ? "dd-menu-right" : ""}`} role="listbox">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === value}
              className={`dd-option ${o.id === value ? "dd-option-sel" : ""}`}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
            >
              <span className="dd-option-left">
                {o.icon}
                <span className="dd-option-label">{o.label}</span>
                {o.tag && <span className="dd-option-tag">{o.tag}</span>}
              </span>
              <span className="dd-option-right">
                {o.badge && <span className="dd-badge">{o.badge}</span>}
                {o.id === value && <span className="dd-check" aria-hidden="true">✓</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Idioma ----------
// "es" → entrevista y respuesta en español.
// "en" → entrevista y respuesta en inglés.
type Lang = "es" | "en";
const STT_LANG: Record<Lang, string> = { es: "es", en: "en" };
const ANSWER_LANG: Record<Lang, "es" | "en"> = { es: "es", en: "en" };

// ---------- Modelos de LLM ----------
// La lista vive en app/lib/models.ts, compartida con /simulador y con los dos
// routes: además del label, cada modelo declara la FORMA de su request (Gemini
// 2.5 vs 3.x usan parámetros de thinking distintos y mutuamente excluyentes),
// así que el registro tiene que ser único. Si falta la key de un proveedor, el
// backend devuelve un error claro y /api/models/health lo lista.

function buildDgUrl(sttLang: string): string {
  const params = new URLSearchParams({
    model: "nova-2",
    language: sttLang,
    smart_format: "true",
    interim_results: "true",
    endpointing: "500",
    utterance_end_ms: "1000", // mínimo impuesto por Deepgram — NO bajar de 1000
    vad_events: "true",
    encoding: "linear16",
    sample_rate: "16000",
    channels: "1",
  }).toString();
  return `wss://api.deepgram.com/v1/listen?${params}`;
}

// Pantalla puente entre el fin de la entrevista y el pedido de email. Sin
// esto, cortar la sesión hacía aparecer de golpe un formulario: primero se
// muestra que hay algo procesándose y recién después se pide el email, que es
// el orden en que la espera se entiende como trabajo y no como peaje.
const ANALYZING_STEPS = [
  "Cerrando la grabación",
  "Ordenando la transcripción",
  "Detectando las preguntas de la entrevista",
  "Preparando tu reporte Post-Mortem",
];
const ANALYZING_STEP_MS = 700;

function AnalyzingScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  // onDone en un ref: si el padre lo recrea en cada render, el intervalo no
  // tiene que reiniciarse por eso (volvería a empezar la cuenta de pasos).
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const t = setInterval(() => {
      setStep((s) => {
        const next = s + 1;
        if (next >= ANALYZING_STEPS.length) {
          clearInterval(t);
          // Fuera del setState: llamarlo durante el render del padre es un
          // update anidado que React rechaza.
          setTimeout(() => doneRef.current(), ANALYZING_STEP_MS);
        }
        return next;
      });
    }, ANALYZING_STEP_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="paywall-overlay">
      <div className="paywall analyzing" role="status" aria-live="polite">
        <div className="paywall-title">Analizando tu entrevista… 🦜</div>
        <p className="paywall-text">
          Estamos revisando lo que pasó en la llamada para armar tu reporte.
        </p>
        <ol className="analyzing-steps">
          {ANALYZING_STEPS.map((label, i) => (
            <li
              key={i}
              className={i < step ? "analyzing-step-done" : i === step ? "analyzing-step-active" : ""}
            >
              <span className="analyzing-mark" aria-hidden="true">
                {i < step ? "✓" : <span className="analyzing-spinner" />}
              </span>
              {label}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ---------- Fiesta al activar el pase ----------
// Alguien acaba de pagar y entrar: es EL momento del producto, así que la
// pantalla entera se pone de fiesta unos segundos.
const PARTY_MS = 6000;
const PARTY_COLORS = ["#10b981", "#34d399", "#a3e635", "#fbbf24", "#f59e0b", "#fb7185", "#22d3ee"];
const PARTY_EMOJIS = ["🦜", "👑", "🎉", "✨", "🎊", "🔥", "💚", "🌈", "🥳"];

function PassParty({ pass, onDone }: { pass: ActivePass; onDone: () => void }) {
  // Las partículas se sortean una sola vez: si se recalcularan en cada render
  // saltarían de lugar en el medio de la animación.
  const bits = useMemo(() => {
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const papelitos = Array.from({ length: 110 }, (_, i) => ({
      key: `c${i}`,
      left: rnd(0, 100),
      delay: rnd(0, 2.2),
      dur: rnd(2.4, 4.6),
      drift: rnd(-16, 16),
      spin: rnd(360, 1200) * (Math.random() < 0.5 ? -1 : 1),
      w: rnd(6, 12),
      h: rnd(9, 18),
      color: PARTY_COLORS[i % PARTY_COLORS.length],
      redondo: Math.random() < 0.25,
    }));
    const emojis = Array.from({ length: 34 }, (_, i) => ({
      key: `e${i}`,
      left: rnd(0, 100),
      delay: rnd(0, 2.8),
      dur: rnd(3, 5.2),
      drift: rnd(-14, 14),
      spin: rnd(-70, 70),
      size: rnd(22, 46),
      char: PARTY_EMOJIS[i % PARTY_EMOJIS.length],
    }));
    return { papelitos, emojis };
  }, []);

  // Se cierra sola. Igual se puede tocar para saltearla: nadie debería quedar
  // esperando a que termine una animación para usar lo que compró.
  useEffect(() => {
    const t = setTimeout(onDone, PARTY_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="party" onClick={onDone} role="status" aria-live="polite">
      <div className="party-wash" aria-hidden="true" />
      <div className="party-bits" aria-hidden="true">
        {bits.papelitos.map((p) => (
          <span
            key={p.key}
            className={`party-confetti${p.redondo ? " party-confetti-round" : ""}`}
            style={
              {
                left: `${p.left}%`,
                background: p.color,
                width: `${p.w}px`,
                height: `${p.h}px`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.dur}s`,
                "--drift": `${p.drift}vw`,
                "--spin": `${p.spin}deg`,
              } as React.CSSProperties
            }
          />
        ))}
        {bits.emojis.map((e) => (
          <span
            key={e.key}
            className="party-emoji"
            style={
              {
                left: `${e.left}%`,
                fontSize: `${e.size}px`,
                animationDelay: `${e.delay}s`,
                animationDuration: `${e.dur}s`,
                "--drift": `${e.drift}vw`,
                "--spin": `${e.spin}deg`,
              } as React.CSSProperties
            }
          >
            {e.char}
          </span>
        ))}
      </div>

      <div className="party-card">
        <div className="party-parrot" aria-hidden="true">
          🦜
        </div>
        <div className="party-title">¡YA SOS LORO! 🎉</div>
        <p className="party-text">
          Tu pase quedó activo. Sesiones sin límite de tiempo ni de cantidad hasta el{" "}
          <strong>{fmtPassExpiry(pass.expiresAt)}</strong>.
        </p>
        <p className="party-text party-text-dim">Andá a romperla en esa entrevista 👑</p>
        <span className="party-skip">tocá para seguir</span>
      </div>
    </div>
  );
}

/**
 * Paso de pago: se elige el pase y acá se elige CÓMO pagarlo.
 *
 * Argentina va por Mercado Pago con link directo; el resto del mundo por
 * Binance Pay, cuyo QR todavía se manda a mano. En los dos casos el alta la
 * hace una persona con el comprobante, así que el cierre siempre es WhatsApp —
 * y eso se dice de entrada para que nadie pague esperando un alta automática.
 */
function PagoPaso({
  plan,
  onClose,
  onWhatsApp,
}: {
  plan: PassPlan;
  onClose: () => void;
  onWhatsApp: (msg: string) => void;
}) {
  const p = PLANES[plan];
  return (
    <div className="paywall-overlay" onClick={onClose}>
      <div className="paywall paywall-wide" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="paywall-close" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
        <div className="paywall-title">Elegí cómo pagar</div>
        <p className="paywall-text">
          {p.titulo} — <strong>{p.precio}</strong>
        </p>

        {/* El nombre del método está en el badge, así que el botón solo dice
            "Pagar": repetirlo era ruido en una tarjeta que ya se entiende. */}
        <div className="stype-card">
          <div className="stype-head">
            <span className="stype-name">
              <BannerIcon /> Argentina
            </span>
            <span className="stype-badge">Mercado Pago</span>
          </div>
          <a
            className="btn-action btn-primary"
            href={p.mercadoPago}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track(plan === "week" ? "pay_mp_week" : "pay_mp_year")}
          >
            Pagar
          </a>
        </div>

        <div className="stype-card">
          <div className="stype-head">
            <span className="stype-name">
              <WorldIcon /> Resto del mundo
            </span>
            <span className="stype-badge">Binance Pay</span>
          </div>
          {p.binance ? (
            <>
              <a
                className="btn-action btn-primary"
                href={p.binance.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track(plan === "week" ? "pay_binance_week" : "pay_binance_year")}
              >
                Pagar
              </a>
              {/* Imagen normal y no next/image: es un QR chico y estático, y así
                  se puede tocar y guardar para escanearlo desde la galería.
                  Sirve para quien está en la compu; en el celular el botón de
                  arriba abre la app directo. */}
              <img
                className="pago-qr"
                src={p.binance.qr}
                alt="QR de Binance Pay para pagar el pase"
              />
              <p className="paywall-fineprint pago-qr-nota">o escaneá el QR</p>
            </>
          ) : (
            <button
              className="btn-action btn-outline"
              onClick={() => {
                track(plan === "week" ? "pay_binance_week" : "pay_binance_year");
                onWhatsApp(`${p.wa} Pago desde afuera de Argentina, ¿me pasás el QR de Binance?`);
              }}
            >
              Pedime el QR por WhatsApp
            </button>
          )}
        </div>

        <p className="paywall-fineprint pago-nota">
          Cuando pagues, mandame el comprobante por{" "}
          <a
            href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
              `${p.wa} Ya pagué, te mando el comprobante.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("pay_receipt_click")}
          >
            WhatsApp
          </a>{" "}
          y te activo en minutos.
        </p>
      </div>
    </div>
  );
}

const LS_KEY = "copiloto:context:v1";

/**
 * El pase viaja en cada pedido caro. Se lee del storage en el momento (y no de
 * un estado de React) para que el header sea correcto incluso en la primera
 * llamada, antes de que termine la revalidación.
 */
function passHeader(): Record<string, string> {
  const t = storedPassToken();
  return t ? { [PASS_HEADER]: t } : {};
}

// ---------- Cuota gratuita (100% client-side, sin backend) ----------
// Cada navegador arranca con FREE_SESSIONS sesiones de hasta SESSION_MAX_MS.
// Se descuenta 1 al arrancar. Al agotarse, se muestra el paywall con los pases
// ilimitados. Es escasez percibida, no protección de costos (se saltea borrando
// storage / incógnito — a propósito en esta fase de guerrilla).
const SESSIONS_KEY = "loreado:sessions:v1";
const FREE_SESSIONS = 10;
const SESSION_MAX_MS = 10 * 60 * 1000;
const SESSION_MAX_MIN = Math.round(SESSION_MAX_MS / 60000);

// Pases pagos. No hay créditos: se vende acceso ilimitado por tiempo.
const WA_NUMBER = "5491164090022";
const PASS_WEEK_PRICE = "$19.99 USD";
const PASS_YEAR_PRICE = "$89 USD";

type PassPlan = "week" | "year";

/**
 * Cómo se cobra cada pase. Argentina va por Mercado Pago (link directo); el
 * resto del mundo por Binance Pay, cuyo QR todavía mando a mano por WhatsApp.
 * En los dos casos el alta la hago yo con el comprobante, así que el último
 * paso siempre es el chat.
 */
type Plan = {
  titulo: string;
  precio: string;
  mercadoPago: string;
  /**
   * Binance Pay. `url` es lo que codifica el QR: en el celular abre la app
   * directo, que es mejor que pedirle a alguien que escanee su propia
   * pantalla. `qr` queda para quien está en la compu y escanea con el teléfono.
   * Sin esto todavía, se pide por WhatsApp.
   */
  binance?: { url: string; qr: string };
  wa: string;
};

const PLANES: Record<PassPlan, Plan> = {
  week: {
    titulo: "Pase Rey Loro Ilimitado (7 días)",
    precio: PASS_WEEK_PRICE,
    mercadoPago: "https://mpago.la/17qBami",
    binance: { url: "https://app.binance.com/uni-qr/XARJMtuK", qr: "/binance-qr-semanal.png" },
    wa: `Hey Loro creador! Quiero el Pase Rey Loro Ilimitado de 7 días (${PASS_WEEK_PRICE}) para mi próxima entrevista. ¿Cómo avanzo Loro?`,
  },
  year: {
    titulo: "Pase de 12 meses",
    precio: PASS_YEAR_PRICE,
    mercadoPago: "https://mpago.la/1W9PQTG",
    wa: `Hey Loro creador! Quiero el pase de 12 meses (${PASS_YEAR_PRICE}), estoy super tranqui que voy a conseguir el mejor trabajo. ¿Cómo avanzo Loro?`,
  },
};

// ---------- Endpointing semántico ----------
export default function Page() {
  const [status, setStatus] = useState<Status>("idle");
  const [mode, setMode] = useState<Mode>("mic");
  const [error, setError] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [profile, setProfile] = useState("");
  const [lang, setLang] = useState<Lang>("es");
  const [answerSize, setAnswerSize] = useState<AnswerSizeId>(DEFAULT_ANSWER_SIZE);
  // Respuesta automática: genera sola al detectar que el entrevistador terminó
  // de hablar, sin tocar "Responder".
  const [autoAnswer, setAutoAnswer] = useState(false);
  const autoAnswerRef = useRef(false);
  useEffect(() => {
    autoAnswerRef.current = autoAnswer;
  }, [autoAnswer]);
  // Espera antes de responder sola: una pregunta larga suele tener pausas en el
  // medio, y cada pausa llega como "fin de intervención". Sin esta espera, cada
  // una dispararía una respuesta que cancela la anterior. El timer se reinicia
  // si el entrevistador sigue hablando, así que solo responde cuando la pausa
  // se sostiene de verdad.
  const autoAnswerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [lines, setLines] = useState<Line[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  // Cuota gratuita
  const [sessionsUsed, setSessionsUsed] = useState(0);
  const sessionsUsedRef = useRef(0);
  const [showPaywall, setShowPaywall] = useState(false);
  // Por qué se muestra el paywall: "quota" = se acabaron las sesiones gratis
  // del navegador; "capacity" = kill switch global del server (CAPACITY_CLOSED),
  // donde solo queda la lista de espera.
  const [paywallReason, setPaywallReason] = useState<"quota" | "capacity">("quota");
  // Elección de tipo de sesión antes de arrancar (pase ilimitado vs. gratis).
  const [showSessionType, setShowSessionType] = useState(false);
  // Pase elegido: mientras está seteado se muestra el paso de pago.
  const [payPlan, setPayPlan] = useState<PassPlan | null>(null);
  // Hay video de la pestaña compartida para mostrar al lado de las respuestas.
  const [sharing, setSharing] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [sending, setSending] = useState(false);
  // Pase ilimitado: sin corte de tiempo ni tope de sesiones mientras esté
  // vigente. `checking` evita mostrarle el paywall a alguien que ya pagó
  // durante el instante en que se revalida.
  const {
    pass,
    checking: passChecking,
    error: passError,
    activate: activatePass,
    celebrate,
    endCelebration,
  } = usePass();
  const passRef = useRef<typeof pass>(null);
  useEffect(() => {
    passRef.current = pass;
  }, [pass]);
  /**
   * Campos obligatorios que quedaron vacíos al intentar arrancar. Se llena
   * recién al tocar el botón —no mientras se escribe— para no marcarle nada en
   * rojo a alguien que todavía está completando el formulario.
   */
  const [faltan, setFaltan] = useState<{ company?: boolean; role?: boolean }>({});
  const [passInput, setPassInput] = useState("");
  const [passOpen, setPassOpen] = useState(false);
  const [passBusy, setPassBusy] = useState(false);
  const sessionsLeft = Math.max(0, FREE_SESSIONS - sessionsUsed);
  // Countdown de la sesión (10 min gratis), estilo Parakeet.
  const [remainingSec, setRemainingSec] = useState(Math.round(SESSION_MAX_MS / 1000));
  // Al terminar una sesión el copiloto cae en la lista de sesiones (como
  // Parakeet), no de vuelta en el formulario.
  const [view, setView] = useState<"setup" | "analyzing" | "gate" | "sessions">("setup");
  // Sesión recién terminada: se abre sola en Notas IA al pasar el gate.
  const [justEndedId, setJustEndedId] = useState<string | null>(null);
  // Cuántas sesiones hay guardadas: si hay, el setup ofrece el acceso al
  // historial. Sin esto solo se llegaba terminando una sesión nueva.
  const [savedCount, setSavedCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /**
   * Video de la pestaña compartida. Va aparte del stream de audio porque a
   * Deepgram solo se le manda audio, pero el video se muestra en pantalla.
   */
  const shareStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const wakeLockRef = useRef<any>(null);
  const keepAliveRef = useRef<any>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Reconexión: distingue cierres pedidos por el usuario (stop/cleanup) de
  // caídas inesperadas del WS en medio de la entrevista.
  const intentionalCloseRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // El presupuesto de reintentos solo se renueva si la conexión se mantuvo
  // estable un rato — así una conexión que "flapea" (abre y cae al instante)
  // igual agota los 3 intentos y se rinde, en vez de reconectar para siempre.
  const stableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Recuperación al volver de segundo plano: reconecta si el socket murió
  // mientras la app estaba en background (Deepgram corta a los ~10s sin audio).
  const resumeRef = useRef<(() => void) | null>(null);

  // Material de la sesión en curso, para guardarla al terminar. Va en refs
  // porque lo lee `stop()`, que se crea una sola vez y no puede cerrar sobre
  // el estado sin quedar viejo.
  const sessionStartRef = useRef(0);
  const sessionLinesRef = useRef<{ text: string; ts: number }[]>([]);
  const answersRef = useRef<Answer[]>([]);
  const sessionCtxRef = useRef({ company: "", role: "", modelId: "", lang: "es" as Lang, mode: "mic" as Mode });
  const transcriptRef = useRef(""); // todo lo transcripto (contexto para el LLM)
  const questionBufRef = useRef(""); // último tramo dicho, para "Responder ahora"
  const lineId = useRef(0);
  const ansId = useRef(0);
  // Respuesta en curso: permite abortarla si se pide otra o se limpia.
  const turnRef = useRef<{ id: number; sentText: string; controller: AbortController | null } | null>(null);

  const scrollA = useRef<HTMLDivElement | null>(null);
  const scrollT = useRef<HTMLDivElement | null>(null);

  // Modelo elegido, siempre fresco (evita closures viejas en runGenerate).
  const selectedModel = MODELS.find((m) => m.id === modelId) || MODELS[0];
  const modelRef = useRef(selectedModel);
  modelRef.current = selectedModel;
  answersRef.current = answers;
  sessionCtxRef.current = { company, role, modelId, lang, mode };

  useEffect(() => {
    if (view === "setup") setSavedCount(loadSessions().length);
  }, [view]);

  // ---------- Detección de mobile / Safari ----------
  // "Pestaña" (captura de audio vía getDisplayMedia) no tiene sentido en dos
  // casos: en mobile (iOS y Android) no hay pestañas de Meet/Zoom que
  // compartir desde el propio celular; y en Safari —incluso de escritorio,
  // en Mac— getDisplayMedia no soporta capturar audio (solo video), así que
  // ahí "Pestaña" siempre termina en el error de "no se compartió audio". En
  // ambos casos se usa directo micrófono.
  const [noTabCapture, setNoTabCapture] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent || "";
    const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const mobile = iOS || /Android|Mobi/.test(ua);
    const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);
    const noTab = mobile || isSafari;
    setNoTabCapture(noTab);
    // En desktop con soporte de captura de pestaña, "Pestaña" es el modo
    // correcto (audio digital directo de Meet/Zoom); "Micrófono" queda como
    // fallback manual (ej. celular apoyado cerca de los parlantes).
    setMode(noTab ? "mic" : "tab");
  }, []);

  // iOS suspende el AudioContext al bloquear pantalla o cambiar de app.
  // Al volver, lo reactivamos y reintentamos el wake lock.
  useEffect(() => {
    const onResume = () => {
      if (document.visibilityState !== "visible") return;
      if (audioCtxRef.current?.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
      // Da un instante a que el AudioContext y el micrófono se reactiven antes
      // de chequear si hay que reconectar el socket.
      setTimeout(() => resumeRef.current?.(), 300);
    };
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("pageshow", onResume);
    return () => {
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("pageshow", onResume);
    };
  }, []);

  // Funnel: el usuario llegó a la app.
  useEffect(() => {
    track("enter_app");
  }, []);

  // Carga la cuota gratuita usada (persistida en el navegador).
  useEffect(() => {
    try {
      const n = parseInt(localStorage.getItem(SESSIONS_KEY) || "0", 10);
      const used = Number.isFinite(n) ? Math.max(0, n) : 0;
      sessionsUsedRef.current = used;
      setSessionsUsed(used);
    } catch {}
  }, []);

  // ---------- Contexto persistido (empresa / puesto / perfil) ----------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.company) setCompany(saved.company);
      if (saved.role) setRole(saved.role);
      if (saved.profile) setProfile(saved.profile);
      // El modelo sí se restaura (preferencia persistente del usuario).
      if (saved.modelId && isSelectable(saved.modelId)) setModelId(saved.modelId);
      // Idioma: se restaura la última preferencia (es/en).
      if (saved.lang === "es" || saved.lang === "en") setLang(saved.lang);
      if (saved.answerSize && ANSWER_SIZES.some((s) => s.id === saved.answerSize)) {
        setAnswerSize(saved.answerSize);
      }
      if (typeof saved.autoAnswer === "boolean") setAutoAnswer(saved.autoAnswer);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ company, role, profile, modelId, lang, answerSize, autoAnswer })
      );
    } catch {}
  }, [company, role, profile, modelId, lang, answerSize, autoAnswer]);

  // ---------- Generación ----------
  // Ejecuta el fetch/stream para una tarjeta ya asignada (id + controller ya
  // decididos por fireIfNew). Si un fireIfNew posterior cancela este
  // controller, el AbortError se ignora en silencio: ya hay una versión
  // mejor en camino para la misma tarjeta.
  const runGenerate = useCallback(
    async (id: number, question: string, controller: AbortController, attempt = 0) => {
      // Crea/resetea la tarjeta (en un reintento la vaciamos para re-streamear).
      setAnswers((prev) => {
        const card: Answer = {
          id,
          question: lastQuestions(question),
          text: "",
          done: false,
          ts: Date.now(),
          feedback: null,
        };
        return prev.some((a) => a.id === id)
          ? prev.map((a) => (a.id === id ? card : a))
          : [...prev, card].slice(-20); // cronológico: nuevas abajo
      });
      const startedAt = Date.now();
      try {
        const res = await fetch("/api/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...passHeader() },
          body: JSON.stringify({
            profile,
            company,
            role,
            answerLang: ANSWER_LANG[lang],
            provider: modelRef.current.provider,
            model: modelRef.current.model,
            transcript: transcriptRef.current.slice(-4000),
            question,
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          let detail = (await res.text().catch(() => "")).slice(0, 300);
          // El kill switch (y otros errores JSON) devuelven { error }: mostramos
          // el mensaje limpio en vez del JSON crudo.
          try {
            const j = JSON.parse(detail);
            if (j?.error) detail = j.error;
          } catch {}
          setAnswers((prev) =>
            prev.map((a) =>
              a.id === id
                ? { ...a, text: detail ? `⚠️ ${detail}` : "· Error generando respuesta.", done: true }
                : a
            )
          );
          track("answer_failed", { reason: detail || "http_error", duration_ms: Date.now() - startedAt });
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          setAnswers((prev) => prev.map((a) => (a.id === id ? { ...a, text: acc } : a)));
        }
        // El modelo a veces devuelve el placeholder "(esperando pregunta)" (o
        // texto vacío) en la primera respuesta, aunque la pregunta sea real.
        // Reintentamos UNA vez automáticamente en vez de dejar la tarjeta así.
        const finalText = acc.trim();
        const isPlaceholder =
          !finalText || /esperando pregunta|ninguna a[uú]n/i.test(finalText);
        if (isPlaceholder && attempt < 1 && !controller.signal.aborted) {
          return runGenerate(id, question, controller, attempt + 1);
        }
        setAnswers((prev) => prev.map((a) => (a.id === id ? { ...a, done: true } : a)));
        track("answer_generated", { model: modelRef.current.model, duration_ms: Date.now() - startedAt });
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setAnswers((prev) =>
          prev.map((a) => (a.id === id ? { ...a, text: "· Error de red.", done: true } : a))
        );
        track("answer_failed", { reason: err?.message || "network_error", duration_ms: Date.now() - startedAt });
      }
    },
    [profile, company, role, lang]
  );


  // Disparo manual (ÚNICA forma de responder, como Parakeet): al tocar
  // "Responder ahora" se genera una respuesta sobre lo último dicho. La app
  // NO responde sola mientras la persona habla; solo transcribe.
  const answerNow = useCallback((opts?: { auto?: boolean }) => {
    track("answer_requested", { auto: !!opts?.auto });
    // Aborta una respuesta en curso para no encimar dos generaciones. Si esa
    // respuesta todavía estaba vacía (no llegó ni el primer token), sacamos su
    // tarjeta para que no quede colgada en pantalla al reintentar.
    const prev = turnRef.current;
    prev?.controller?.abort();
    turnRef.current = null;
    if (prev) {
      setAnswers((list) => list.filter((a) => !(a.id === prev.id && !a.done && !a.text)));
    }
    // El botón manual, si el buffer está vacío, cae a lo último transcripto:
    // la persona tocó el botón, algo hay que responder. La respuesta
    // automática NO usa ese fallback — respondería de nuevo lo mismo que
    // acaba de responder, porque generar vacía el buffer pero no el
    // transcript.
    const q = questionBufRef.current.trim() || (opts?.auto ? "" : transcriptRef.current.trim().slice(-500));
    questionBufRef.current = "";
    if (q.trim().length < 2) return;
    const id = ++ansId.current;
    const controller = new AbortController();
    // Registrar el turno en curso: así el próximo toque a "Responder" (o
    // clearAll/cleanup) puede abortar este stream de verdad.
    turnRef.current = { id, sentText: q, controller };
    runGenerate(id, q, controller);
  }, [runGenerate]);

  // El handler del socket se crea una sola vez (deps []), así que no puede
  // cerrar sobre `answerNow` sin quedar viejo: se lo pasa por ref.
  const answerNowRef = useRef(answerNow);
  useEffect(() => {
    answerNowRef.current = answerNow;
  }, [answerNow]);

  // Feedback 👍/👎 por respuesta. Togglea el estado visual y manda el evento a
  // analytics (única señal de calidad de respuestas que tenemos).
  const setFeedback = useCallback((id: number, fb: "up" | "down") => {
    setAnswers((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const next = a.feedback === fb ? null : fb;
        if (next) track("answer_feedback", { rating: next, model: modelRef.current.model });
        return { ...a, feedback: next };
      })
    );
  }, []);

  // Copia la respuesta al portapapeles con feedback breve.
  const copyAnswer = useCallback((id: number, text: string) => {
    const clean = text.replace(/\n{3,}/g, "\n\n").trim();
    navigator.clipboard
      ?.writeText(clean)
      .then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
        track("answer_copied", { model: modelRef.current.model });
      })
      .catch(() => {});
  }, []);

  // Limpia respuestas y transcripción en pantalla (como el "Clear" de Parakeet),
  // sin cortar la sesión: el Loro sigue escuchando.
  const clearAll = useCallback(() => {
    turnRef.current?.controller?.abort();
    turnRef.current = null;
    questionBufRef.current = "";
    setAnswers([]);
    setLines([]);
  }, []);

  // Lista de espera: manda el email a /api/waitlist, que reenvía al Google Form
  // desde el servidor y reporta éxito/fallo REAL (no el submit opaco no-cors).
  const submitWaitlist = useCallback(async () => {
    const em = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setEmailError("Poné un email válido.");
      return;
    }
    setSending(true);
    setEmailError("");
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        setEmailSent(true);
        track("waitlist_submit");
        identify(em, { email: em });
      } else {
        setEmailError(j.error || "No se pudo enviar. Probá de nuevo.");
      }
    } catch {
      setEmailError("Error de red. Probá de nuevo.");
    } finally {
      setSending(false);
    }
  }, [email]);

  // Gate del informe post-entrevista: mismo endpoint que la lista de espera,
  // pero acá el email desbloquea el reporte de la sesión que acaba de terminar.
  const submitGateEmail = useCallback(async () => {
    const em = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setEmailError("Poné un email válido.");
      return;
    }
    setSending(true);
    setEmailError("");
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        rememberEmail(em);
        track("app_email_submit");
        identify(em, { email: em });
        setView("sessions");
      } else {
        setEmailError(j.error || "No se pudo enviar. Probá de nuevo.");
      }
    } catch {
      setEmailError("Error de red. Probá de nuevo.");
    } finally {
      setSending(false);
    }
  }, [email]);

  /**
   * Marca en rojo los campos obligatorios vacíos y lleva el primero a la vista.
   * Devuelve true si se puede avanzar.
   */
  const marcarFaltantes = useCallback(() => {
    const falta = { company: !company.trim(), role: !role.trim() };
    setFaltan(falta);
    if (!falta.company && !falta.role) return true;
    // El formulario puede estar fuera de pantalla cuando se toca el botón
    // (queda fijo abajo), así que se muestra el campo marcado; si no, el rojo
    // aparece donde nadie lo ve y el botón parece no hacer nada.
    const id = falta.company ? "falta-empresa" : "falta-puesto";
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return false;
  }, [company, role]);

  // Elegir un pase abre el paso de pago (Mercado Pago / Binance). El alta la
  // hago yo a mano con el comprobante, así que el último paso es WhatsApp.
  const requestPass = useCallback((plan: PassPlan) => {
    track(plan === "week" ? "pass_week_click" : "pass_year_click");
    setPayPlan(plan);
  }, []);

  const openWhatsApp = useCallback((msg: string) => {
    try {
      window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
    } catch {}
  }, []);

  // ---------- Mensajes Deepgram ----------
  const onDgMessage = useCallback(
    (raw: string) => {
      let msg: any;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      // Fin de intervención del entrevistador. En modo manual no hace nada; con
      // la respuesta automática activada, es el disparador — pero un silencio
      // NO es una pregunta: Deepgram manda UtteranceEnd en cada pausa, también
      // después de un "ok, perfecto" o de la presentación del entrevistador.
      // Por eso se exige que el buffer contenga efectivamente una pregunta o un
      // pedido de información (ver app/lib/question.ts). El buffer además tiene
      // que tener texto sin usar: `answerNow` lo vacía al generar, así que sin
      // eso el mismo texto dispararía dos veces.
      if (msg.type === "UtteranceEnd") {
        if (autoAnswerRef.current && looksLikeQuestion(questionBufRef.current)) {
          if (autoAnswerTimerRef.current) clearTimeout(autoAnswerTimerRef.current);
          autoAnswerTimerRef.current = setTimeout(() => {
            autoAnswerTimerRef.current = null;
            // Se vuelve a chequear: en el ínterin pudo apagarse el toggle o
            // haberse respondido a mano (que vacía el buffer).
            if (autoAnswerRef.current && looksLikeQuestion(questionBufRef.current)) {
              answerNowRef.current({ auto: true });
            }
          }, AUTO_ANSWER_DELAY_MS);
        }
        return;
      }
      if (msg.type !== "Results") return;

      const alt = msg.channel?.alternatives?.[0];
      const text: string = alt?.transcript || "";
      if (!text) return;
      const isFinal = !!msg.is_final;

      // Volvió a hablar: la pausa no era el final de la pregunta.
      if (autoAnswerTimerRef.current) {
        clearTimeout(autoAnswerTimerRef.current);
        autoAnswerTimerRef.current = null;
      }

      setLines((prev) => {
        const next = [...prev];
        if (next.length && !next[next.length - 1].final) {
          // Se conserva la hora del primer trozo: es cuando empezó a decirlo.
          const prev0 = next[next.length - 1];
          next[next.length - 1] = { id: prev0.id, text, final: isFinal, ts: prev0.ts };
        } else {
          next.push({ id: ++lineId.current, text, final: isFinal, ts: Date.now() });
        }
        return next.slice(-60);
      });

      // Solo acumulamos texto (contexto + buffer para "Responder ahora"). La
      // generación ocurre EXCLUSIVAMENTE al tocar el botón, así la conversación
      // no avanza sola con respuestas nuevas mientras la persona habla.
      if (isFinal) {
        // Se guarda con hora para poder reconstruir después la conversación en
        // el orden en que pasó, intercalada con las respuestas generadas.
        sessionLinesRef.current.push({ text, ts: Date.now() });
        transcriptRef.current = (transcriptRef.current + " " + text).slice(-8000);
        questionBufRef.current = (questionBufRef.current + " " + text).slice(-1500);
      }
    },
    []
  );

  // ---------- Captura ----------
  const acquireStream = useCallback(async (m: Mode): Promise<MediaStream> => {
    if (m === "tab") {
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const at = s.getAudioTracks();
      if (at.length === 0) {
        s.getTracks().forEach((t) => t.stop());
        throw new Error('No se compartió audio. Al elegir la pestaña activá "Compartir audio de la pestaña".');
      }
      // El video de la pestaña compartida se conserva (antes se descartaba)
      // para mostrarlo al lado de las respuestas: así se ve la entrevista y el
      // copiloto en la misma pantalla, sin cambiar de ventana.
      const vt = s.getVideoTracks();
      if (vt.length) {
        shareStreamRef.current = new MediaStream(vt);
        setSharing(true);
        // Si se corta el compartir desde la barra del navegador, el recuadro
        // tiene que desaparecer en vez de quedar congelado.
        vt[0].addEventListener("ended", () => {
          shareStreamRef.current = null;
          setSharing(false);
        });
      }
      return new MediaStream(at);
    }
    // mic
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  }, []);

  const start = useCallback(async () => {
    // Cuota gratuita: si no quedan sesiones, se muestra el paywall. Con pase
    // vigente no hay cuota que chequear.
    if (!passRef.current && sessionsUsedRef.current >= FREE_SESSIONS) {
      setPaywallReason("quota");
      setShowPaywall(true);
      track("paywall_shown");
      return;
    }
    setShowSessionType(false);
    setError("");
    setStatus("connecting");
    questionBufRef.current = "";
    intentionalCloseRef.current = false;
    reconnectAttemptsRef.current = 0;
    turnRef.current?.controller?.abort();
    turnRef.current = null;
    // Idioma del entrevistador (STT) fijado al inicio de la sesión.
    const dgUrl = buildDgUrl(STT_LANG[lang]);
    try {
      const stream = await acquireStream(mode);
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === "suspended") await audioCtx.resume();
      await audioCtx.audioWorklet.addModule("/pcm-worklet.js");
      const source = audioCtx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(audioCtx, "pcm-worklet");
      workletRef.current = worklet;
      // El handler apunta siempre al socket vigente vía wsRef: tras una
      // reconexión el audio fluye solo al socket nuevo, sin re-cablear nada.
      worklet.port.onmessage = (e) => {
        const w = wsRef.current;
        if (w && w.readyState === WebSocket.OPEN) w.send(e.data);
      };
      source.connect(worklet);

      // Abre (o reabre) el WebSocket contra Deepgram reusando el mismo
      // stream/worklet: en una reconexión NO se vuelve a pedir permiso de
      // micrófono ni de pestaña, solo se reconstruye el socket.
      const connectWs = async () => {
        const tokRes = await fetch("/api/deepgram-token", {
          method: "POST",
          headers: passHeader(),
        });
        if (!tokRes.ok) {
          const e = await tokRes.json().catch(() => ({}));
          // Kill switch global del server: no es un error de conexión, es
          // "no hay más cupo hoy" → lo maneja el catch de start() con paywall.
          if (tokRes.status === 503 && e.closed) {
            const err = new Error(e.error || "Cupos agotados por hoy.");
            err.name = "CapacityClosed";
            throw err;
          }
          throw new Error(e.error || "No se pudo obtener token de Deepgram.");
        }
        const { token, scheme } = await tokRes.json();

        // Token temporal de Deepgram (grant): usa esquema "bearer". Fallback a
        // "token" por compatibilidad si el backend no mandara scheme.
        const ws = new WebSocket(dgUrl, [scheme || "token", token]);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onopen = () => {
          setError("");
          setStatus("live");
          // Renueva el presupuesto de reintentos solo si la conexión aguanta
          // 10s estable (no apenas abre): evita el loop infinito de flapping.
          if (stableTimerRef.current) clearTimeout(stableTimerRef.current);
          stableTimerRef.current = setTimeout(() => {
            reconnectAttemptsRef.current = 0;
          }, 10000);
          // Keepalive: Deepgram cierra tras ~10s de silencio sin datos.
          if (keepAliveRef.current) clearInterval(keepAliveRef.current);
          keepAliveRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN)
              ws.send(JSON.stringify({ type: "KeepAlive" }));
          }, 7000);
        };
        ws.onmessage = (e) => onDgMessage(e.data);
        ws.onerror = (err) => {
          console.error("Deepgram WebSocket error:", err);
        };
        ws.onclose = (event) => {
          if (stableTimerRef.current) {
            clearTimeout(stableTimerRef.current);
            stableTimerRef.current = null;
          }
          if (intentionalCloseRef.current) return; // stop()/cleanup() maneja el estado
          if (scheduleReconnect()) return;
          cleanup();
          if (event.code !== 1000 && event.code !== 1001) {
            setError("Se cortó la conexión. Revisá tu internet y tocá para reanudar.");
            setStatus("error");
          } else {
            setStatus((s) => (s === "error" ? s : "idle"));
          }
        };
      };

      // Caída inesperada en medio de la sesión: reintenta hasta 3 veces con
      // backoff corto, mientras el audio siga vivo. Devuelve false si ya no
      // corresponde reintentar (el llamador decide el estado final).
      const scheduleReconnect = (): boolean => {
        const trackAlive = stream.getAudioTracks()[0]?.readyState === "live";
        if (intentionalCloseRef.current || !trackAlive || reconnectAttemptsRef.current >= 3) return false;
        reconnectAttemptsRef.current += 1;
        setError(`Se cortó la conexión — reconectando (intento ${reconnectAttemptsRef.current}/3)…`);
        const delay = 600 * 2 ** (reconnectAttemptsRef.current - 1); // 600ms, 1.2s, 2.4s
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          connectWs().catch(() => {
            // Falló antes de abrir el socket (p.ej. el fetch del token):
            // reintenta por el mismo camino o rinde el turno con error.
            if (!scheduleReconnect()) {
              cleanup();
              setError("Se perdió la conexión y no se pudo reanudar. Tocá para reintentar.");
              setStatus("error");
            }
          });
        }, delay);
        return true;
      };

      // Al volver de segundo plano: si el socket murió mientras la app estaba
      // en background (Deepgram corta a los ~10s sin audio) pero el micrófono
      // sigue vivo, reconectamos solos en vez de dejar el error en pantalla.
      resumeRef.current = () => {
        if (intentionalCloseRef.current) return;
        const w = wsRef.current;
        const socketDead = !w || w.readyState === WebSocket.CLOSING || w.readyState === WebSocket.CLOSED;
        const trackAlive = stream.getAudioTracks()[0]?.readyState === "live";
        if (!socketDead || !trackAlive) return;
        if (reconnectTimerRef.current) return; // ya hay una reconexión en curso
        reconnectAttemptsRef.current = 0;
        setError("Reconectando…");
        setStatus("connecting");
        connectWs().catch(() => {
          if (!scheduleReconnect()) {
            cleanup();
            setError("Se perdió la conexión y no se pudo reanudar. Tocá para reintentar.");
            setStatus("error");
          }
        });
      };

      await connectWs();

      // La sesión arrancó de verdad (audio + socket). Con pase no se descuenta
      // cuota ni se arma el corte: es lo que se compró.
      const conPase = !!passRef.current;
      if (!conPase) {
        const used = sessionsUsedRef.current + 1;
        sessionsUsedRef.current = used;
        setSessionsUsed(used);
        try {
          localStorage.setItem(SESSIONS_KEY, String(used));
        } catch {}
      }
      track("session_start", { mode, model: modelRef.current.model, pass: conPase });
      const startedAt = Date.now();
      sessionStartRef.current = startedAt;
      sessionLinesRef.current = [];
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (!conPase) {
        sessionTimerRef.current = setTimeout(() => stop(), SESSION_MAX_MS);
        // Countdown visible (pill "mm:ss"), tick cada segundo.
        setRemainingSec(Math.round(SESSION_MAX_MS / 1000));
        countdownRef.current = setInterval(() => {
          const left = Math.max(0, Math.ceil((SESSION_MAX_MS - (Date.now() - startedAt)) / 1000));
          setRemainingSec(left);
          if (left <= 0 && countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
        }, 1000);
      }

      stream.getAudioTracks()[0].onended = () => stop();

      // Wake lock: evita que el celular apague la pantalla en modo mic.
      try {
        // @ts-ignore
        if (navigator.wakeLock) wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch {}
    } catch (err: any) {
      cleanup();
      if (err?.name === "CapacityClosed") {
        // Sin cupo global: se ve como escasez (paywall + waitlist), no como
        // una app rota con un error técnico en rojo.
        setStatus("idle");
        setPaywallReason("capacity");
        setShowPaywall(true);
        track("capacity_closed_shown");
        return;
      }
      track("session_error", { error: err?.name || "unknown" });
      setError(err?.message || "Error al iniciar.");
      setStatus("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, acquireStream, onDgMessage, lang]);

  const cleanup = useCallback(() => {
    // Marca el cierre como intencional ANTES de cerrar el WS: su onclose no
    // debe disparar una reconexión.
    intentionalCloseRef.current = true;
    resumeRef.current = null;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
    if (stableTimerRef.current) clearTimeout(stableTimerRef.current);
    stableTimerRef.current = null;
    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    keepAliveRef.current = null;
    if (autoAnswerTimerRef.current) clearTimeout(autoAnswerTimerRef.current);
    autoAnswerTimerRef.current = null;
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    sessionTimerRef.current = null;
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    turnRef.current?.controller?.abort();
    turnRef.current = null;
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN)
        wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
      wsRef.current?.close();
    } catch {}
    try {
      workletRef.current?.disconnect();
    } catch {}
    try {
      audioCtxRef.current?.close();
    } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    // El video de la pestaña no está en streamRef, así que se corta acá: si no,
    // el navegador sigue mostrando "estás compartiendo pantalla" para siempre.
    shareStreamRef.current?.getTracks().forEach((t) => t.stop());
    shareStreamRef.current = null;
    setSharing(false);
    try {
      wakeLockRef.current?.release?.();
    } catch {}
    wsRef.current = null;
    workletRef.current = null;
    audioCtxRef.current = null;
    streamRef.current = null;
    wakeLockRef.current = null;
  }, []);

  const stop = useCallback(() => {
    track("session_stopped");
    cleanup();
    setStatus("idle");
    // La sesión se archiva al terminar y la vista pasa al historial. Solo se
    // guarda si hubo material: una sesión que se cortó antes de transcribir
    // nada dejaría una ficha vacía.
    const startedAt = sessionStartRef.current;
    const lines = sessionLinesRef.current;
    const qa = answersRef.current.filter((a) => a.text.trim()).map((a) => ({ q: a.question, a: a.text, ts: a.ts }));
    if (startedAt && (lines.length || qa.length)) {
      const ctx = sessionCtxRef.current;
      const session: CallSession = {
        id: `${startedAt}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: startedAt,
        company: ctx.company,
        role: ctx.role,
        durationMs: Date.now() - startedAt,
        modelId: ctx.modelId,
        lang: ctx.lang,
        mode: ctx.mode,
        lines,
        qa,
      };
      saveSession(session);
      track("session_saved", { questions: qa.length });
      sessionStartRef.current = 0;
      setJustEndedId(session.id);
      // Siempre pasa primero por el análisis: es lo que cierra la entrevista.
      // Recién cuando termina se decide entre el gate y el informe.
      setView("analyzing");
      return;
    }
    sessionStartRef.current = 0;
    setJustEndedId(null);
    setView("sessions");
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  // Re-adquiere el wake lock al volver a la app: iOS lo libera solo al perder foco.
  useEffect(() => {
    const reacquire = async () => {
      if (document.visibilityState !== "visible" || status !== "live" || wakeLockRef.current) return;
      try {
        // @ts-ignore
        if (navigator.wakeLock) wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch {}
    };
    document.addEventListener("visibilitychange", reacquire);
    return () => document.removeEventListener("visibilitychange", reacquire);
  }, [status]);

  // Al aparecer/llenarse una respuesta nueva, la subimos hasta el tope del área
  // para que la Q&A anterior quede fuera de vista (como Parakeet).
  //
  // Scrollear solo no alcanza: el contenedor no puede pasar de
  // scrollHeight - clientHeight, así que una card más baja que el contenedor
  // nunca llegaba arriba. Por eso primero se le agrega abajo el espacio que
  // falta (--answers-spacer) y recién después se scrollea.
  //
  // Depende del texto de la última card porque mientras llega en streaming la
  // card crece y hay que recalcular. NO depende de `feedback`, así tocar 👍/👎
  // no mueve el scroll.
  // El transcript sigue lo último que se oye, salvo que la persona haya
  // scrolleado hacia arriba para releer algo: ahí no se le mueve el piso.
  useEffect(() => {
    const el = scrollT.current;
    if (!el) return;
    const alFinal = el.scrollHeight - el.clientHeight - el.scrollTop < 80;
    if (alFinal) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const lastAnswerText = answers.length ? answers[answers.length - 1].text : "";
  useEffect(() => {
    const container = scrollA.current;
    if (!container || answers.length === 0) return;
    const last = container.querySelector<HTMLElement>(".answer-card-current");
    if (!last) return;

    // El relleno tiene que ser EXACTAMENTE lo que le falta al contenedor para
    // que la card entre desde arriba: con menos, el scroll queda corto y la
    // card no llega al tope.
    const spacer = Math.max(0, container.clientHeight - last.offsetHeight);
    container.style.setProperty("--answers-spacer", `${spacer}px`);

    const delta = last.getBoundingClientRect().top - container.getBoundingClientRect().top;
    if (delta > 1) container.scrollTo({ top: container.scrollTop + delta, behavior: "smooth" });
  }, [answers.length, lastAnswerText]);

  const live = status === "live";
  const connecting = status === "connecting";

  // El formulario solo se muestra en la vista de setup: cuando termina una
  // sesión, el mismo lugar lo ocupa la lista de sesiones.
  const showSetup = !live && view === "setup";
  // Fuera del setup y de la sesión en vivo no va nada del armazón del
  // formulario: ni el área de contenido ni el footer con su CTA.
  const hideChrome = !live && view !== "setup";

  return (
    <main
      className={`app-container ${live ? "app-live" : ""} ${view === "sessions" && !live ? "app-sessions" : ""}`}
      style={{ ["--answer-size" as string]: `${answerSizePx(answerSize)}px` }}
    >
      <header className="brand-header">
        <div className="brand">
          <BrandLogo />
        </div>
        <div className="header-right">
          {live && (
            <div className="header-center">
              {/* Solo el tiempo restante: el contador de sesiones se sacó de la
                  vista para que la primera línea quede como la de Parakeet. */}
              {pass ? (
                /* Solo "Rey Loro": con la fecha al lado el pill se comía los
                   botones del header en mobile. El vencimiento sigue a mano en
                   la pantalla de setup y en el tooltip. */
                <span
                  className="timer-pill timer-pill-pass"
                  title={`Pase de ${pass.email} · vence ${fmtPassExpiry(pass.expiresAt)}`}
                >
                  👑 Rey Loro
                </span>
              ) : (
                <span className="timer-pill" title="Tiempo restante de la sesión">
                  <ClockIcon />
                  {fmtCountdown(remainingSec)} <span className="timer-free">(Free)</span>
                </span>
              )}
            </div>
          )}
          {!live && connecting && <span className="status-chip">conectando…</span>}
          {!live && status === "error" && <span className="status-chip">error</span>}
          {live && (
            <SessionMenu
              lang={lang}
              onLang={(l) => {
                setLang(l);
                track("lang_changed", { lang: l, from: "session_menu" });
              }}
              sizeId={answerSize}
              onSize={(id) => {
                setAnswerSize(id);
                track("answer_size_changed", { size: id });
              }}
              autoAnswer={autoAnswer}
              onAutoAnswer={(v) => {
                setAutoAnswer(v);
                track("auto_answer_toggled", { on: v });
              }}
            />
          )}
          {live && (
            <button className="stop-x" onClick={stop} aria-label="Detener" title="Detener">
              ✕
            </button>
          )}
        </div>
      </header>

      {showSetup && (
        <p className="tagline">
          El Loro escucha tu entrevista en tiempo real y te sopla las respuestas exactas. 100%
          indetectable en Google Meet, Teams y Zoom. 🦜
        </p>
      )}

      {/* Selectores de idioma + modelo, en una misma línea (estilo Parakeet) */}
      {showSetup && (
        <div>
          <div className="selectors-row">
            <div className="field">
              <label className="mono form-label">Idioma</label>
              <Dropdown
                value={lang}
                onChange={(id) => { setLang(id as Lang); track("lang_changed", { lang: id }); }}
                disabled={connecting}
                ariaLabel="Idioma de la entrevista"
                options={[
                  { id: "es", label: "Español", icon: <span className="dd-flag">🇪🇸</span> },
                  { id: "en", label: "English", icon: <span className="dd-flag">🇺🇸</span> },
                ]}
              />
            </div>
            <div className="field">
              <label className="mono form-label">Modelo de IA</label>
              <Dropdown
                value={modelId}
                onChange={(id) => { setModelId(id); const m = MODELS.find((m) => m.id === id); if (m) track("model_changed", { model: m.model, provider: m.provider }); }}
                disabled={connecting}
                ariaLabel="Modelo de IA"
                alignRight
                options={VISIBLE_MODELS.map((m) => ({
                  id: m.id,
                  label: m.label,
                  short: m.short,
                  icon: <ProviderIcon provider={m.provider} />,
                  // Badge y tag pueden convivir (como en Parakeet: Recomendado + Rápido).
                  tag: m.tag || undefined,
                  badge: m.recommended ? "Recomendado" : undefined,
                }))}
              />
            </div>
          </div>
        </div>
      )}

      {/* Selector de modo: se oculta en mobile (iOS/Android) y en Safari
          —incluso de escritorio—, donde "Pestaña" no tiene sentido o no
          funciona; en esos casos se usa directamente el micrófono. */}
      {showSetup && !noTabCapture && (
        <div className={`grid-responsive`}>
          <button
            className={`btn-select ${mode === "mic" ? "btn-select-active" : ""}`}
            onClick={() => { setMode("mic"); track("mode_changed", { mode: "mic" }); }}
            disabled={connecting}
          >
            🎙️ Micrófono
            <span className="btn-select-sub">Escuchar la sala por mic</span>
          </button>
          <button
            className={`btn-select ${mode === "tab" ? "btn-select-active" : ""}`}
            onClick={() => { setMode("tab"); track("mode_changed", { mode: "tab" }); }}
            disabled={connecting}
          >
            🖥️ Pestaña
            <span className="btn-select-sub">Audio digital de Meet/Zoom</span>
          </button>
        </div>
      )}
      {error && (
        <div className="mono error-box" style={{
          fontSize: 13,
          color: "var(--loro-red-deep)",
          background: "rgba(239, 68, 68, 0.07)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: 12,
          padding: "12px 16px",
          lineHeight: 1.5
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Contexto de la entrevista (solo antes de arrancar) */}
      {showSetup && (
        <div className="panel">
          <label className="mono form-label">
            Contexto de la entrevista
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="mono form-mini-label">
              <BriefcaseIcon /> Empresa
              <InfoTip text="La empresa donde estás entrevistando. Ayuda a que las respuestas suenen específicas de ese lugar." />
            </label>
            <input
              value={company}
              onChange={(e) => {
                setCompany(e.target.value);
                if (faltan.company) setFaltan((f) => ({ ...f, company: false }));
              }}
              placeholder="Ej: Mercado Libre"
              className={`form-input${faltan.company ? " form-input-error" : ""}`}
              disabled={connecting}
              aria-invalid={!!faltan.company}
              aria-describedby={faltan.company ? "falta-empresa" : undefined}
            />
            {faltan.company && (
              <p className="field-error" id="falta-empresa">
                Completá la empresa para arrancar.
              </p>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
            <label className="mono form-mini-label">
              <DocIcon /> Descripción del puesto
              <InfoTip text="Pegá el aviso o el rol al que aplicás: responsabilidades, requisitos, seniority. Cuanto más completo, mejores las respuestas." />
            </label>
            <textarea
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                if (faltan.role) setFaltan((f) => ({ ...f, role: false }));
              }}
              placeholder="Pegá la descripción del puesto: responsabilidades, requisitos, seniority."
              className={`form-textarea form-textarea-sm${faltan.role ? " form-input-error" : ""}`}
              disabled={connecting}
              aria-invalid={!!faltan.role}
              aria-describedby={faltan.role ? "falta-puesto" : undefined}
            />
            {faltan.role && (
              <p className="field-error" id="falta-puesto">
                Completá la descripción del puesto para arrancar.
              </p>
            )}
          </div>
          <label className="mono form-mini-label" style={{ marginTop: 4 }}>
            <UserIcon /> Tu perfil / CV
            <InfoTip text="Pegá tu CV, experiencia y logros. El Loro usa esto para responder en tu nombre con datos reales, sin inventar." />
          </label>
          <textarea
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            placeholder="Pegá tu CV, experiencia o notas. El Loro usará esto para responder."
            className="form-textarea"
            disabled={connecting}
          />
        </div>
      )}

      {/* Tira de escucha de una línea. Con la pestaña compartida al lado hay
          lugar para el transcript completo, así que esta franja solo se usa
          cuando la sesión es de una sola columna. */}
      {live && !sharing && (
        // Franja de escucha: una sola línea de borde a borde, sin tarjeta ni
        // botones (como Parakeet). Lo único que importa acá es ver que el Loro
        // está escuchando y qué viene oyendo.
        <div className="listen-bar mono">
          <span className="eq" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span className="listen-text listen-text-live">
            <ListenText text={lines.length ? lines[lines.length - 1].text : ""} />
          </span>
        </div>
      )}

      {/* Contenido */}
      {!hideChrome && (
      <section className={live && sharing ? "live-split" : ""} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", marginTop: 4 }}>
        {/* Pestaña compartida: la entrevista y el copiloto en la misma
            pantalla. En desktop va a la izquierda; en mobile no existe (ahí el
            modo es micrófono y no hay nada que compartir). */}
        {live && sharing && (
          <div className="live-left">
            <div className="share-pane">
              <video
                className="share-video"
                autoPlay
                playsInline
                muted
                ref={(el) => {
                  if (el && shareStreamRef.current && el.srcObject !== shareStreamRef.current) {
                    el.srcObject = shareStreamRef.current;
                  }
                }}
              />
            </div>
            {/* Transcript en vivo, debajo de la llamada. Con la pantalla
                compartida ocupando la izquierda hay lugar para verlo entero,
                no solo la última línea. */}
            <div className="panel transcript-pane">
              <div className="transcript-head mono">
                <span className="eq" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
                Transcripción en vivo
              </div>
              <div ref={scrollT} className="transcript-body">
                {lines.length === 0 ? (
                  <p className="transcript-empty mono">Escuchando…</p>
                ) : (
                  lines.map((l) => (
                    <div key={l.id} className={`t-line${l.final ? "" : " t-line-interim"}`}>
                      <div className="t-bubble">{l.text}</div>
                      <span className="t-meta mono">Entrevistador · {fmtHora(l.ts)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        {live && (
          <div className="live-right">
          <div className="panel answers-pane" style={{ flex: 1, minHeight: 0 }}>
            <div ref={scrollA} className="answers-container">
              {answers.length === 0 ? (
                <p className="placeholder" style={{ fontSize: 13.5, color: "var(--ink-dim)", lineHeight: 1.6, textAlign: "center", fontStyle: "italic", padding: "8px" }}>
                  Tocá “Responder” cuando termine la pregunta y tu respuesta aparece acá.
                </p>
              ) : (
                answers.map((a, index) => (
                  <div key={a.id} className={`answer-card ${index === answers.length - 1 ? "answer-card-current" : ""}`}>
                    {a.text && (
                      <div className="card-actions">
                        <button
                          className={`card-btn ${copiedId === a.id ? "card-btn-done" : ""}`}
                          onClick={() => copyAnswer(a.id, a.text)}
                          aria-label="Copiar respuesta"
                          title="Copiar respuesta"
                        >
                          {copiedId === a.id ? <CheckIcon /> : <CopyIcon />}
                        </button>
                      </div>
                    )}
                    <div className="answer-card-q-row">
                      <span className="answer-card-label answer-card-label-q">💬 Pregunta</span>
                      <span className="answer-card-question">{a.question}</span>
                    </div>
                    <div className="answer-card-a-row">
                      <span className="answer-card-label answer-card-label-a">⭐ Respuesta</span>
                      <div className="answer-card-text">
                        {a.text ? (
                          // Colapsa líneas en blanco de más entre viñetas, pero conserva
                          // el salto simple que separa la apertura de las viñetas.
                          a.text.replace(/\n{3,}/g, "\n\n").trim()
                        ) : (
                          <span className="mono answer-card-loading">
                            generando…
                          </span>
                        )}
                      </div>
                    </div>
                    {a.text && (
                      <div className="answer-footer">
                        <span className="answer-footer-meta mono">Respuesta · {fmtTime(a.ts)}</span>
                        <div className="fb-btns">
                          <button
                            className={`fb-btn ${a.feedback === "up" ? "fb-up" : ""}`}
                            onClick={() => setFeedback(a.id, "up")}
                            aria-label="Respuesta útil"
                          >
                            <ThumbUpIcon />
                          </button>
                          <button
                            className={`fb-btn ${a.feedback === "down" ? "fb-down" : ""}`}
                            onClick={() => setFeedback(a.id, "down")}
                            aria-label="Respuesta no útil"
                          >
                            <ThumbDownIcon />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          {/* Con la pantalla compartida al lado, las acciones van debajo de su
              propia columna —como en la referencia— en vez de cruzar toda la
              pantalla. Sin compartir siguen en el pie de siempre. */}
          {sharing && (
            <div className="live-actions">
              <div className="clear-row">
                <button onClick={clearAll} className="clear-pill mono">
                  ✕ Limpiar
                </button>
              </div>
              <button onClick={() => answerNow()} className="btn-action btn-primary btn-answer">
                <span className="btn-answer-inner">
                  <SparkleIcon />
                  Responder
                </span>
              </button>
            </div>
          )}
          </div>
        )}

      </section>
      )}

      {view === "analyzing" && !live && (
        <AnalyzingScreen
          // Al terminar el análisis se pide el email; si ya lo dejó (acá o en
          // el simulador), se salta directo al informe.
          onDone={() => setView(savedEmail() ? "sessions" : "gate")}
        />
      )}

      {view === "gate" && !live && (
        <div className="paywall-overlay">
          <div className="paywall postmortem">
            <div className="paywall-title">¿Querés saber cómo te fue realmente? 🦜</div>
            <p className="paywall-text">
              La entrevista terminó. Ahora veamos qué detectó la IA. Ingresá tu email para
              desbloquear tu reporte “Post-Mortem”:
            </p>
            <ul className="postmortem-list">
              <li><span aria-hidden="true">📝</span> Transcripción completa de la llamada.</li>
              <li><span aria-hidden="true">🎯</span> Key Takeaways &amp; Red Flags (puntos fuertes y en qué la pifiaste).</li>
              <li>
                <span aria-hidden="true">💬</span> Chat interactivo: preguntale a la IA cómo podrías
                haber respondido mejor esa pregunta difícil.
              </li>
            </ul>
            <div className="paywall-form">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && submitGateEmail()}
                placeholder="tu@email.com"
                className="form-input"
                aria-label="Tu email"
              />
              <button
                className="btn-action btn-primary"
                onClick={submitGateEmail}
                disabled={!email.trim() || sending}
              >
                {sending ? "Desbloqueando…" : "Desbloquear mi feedback al instante →"}
              </button>
              {emailError && <div className="paywall-error">{emailError}</div>}
            </div>
          </div>
        </div>
      )}

      {view === "sessions" && !live && (
        <CallSessions
          autoOpenId={justEndedId}
          onNew={() => {
            setJustEndedId(null);
            setView("setup");
            setAnswers([]);
            setLines([]);
            transcriptRef.current = "";
            questionBufRef.current = "";
          }}
        />
      )}

      {/* Footer. Con la pantalla compartida las acciones de la sesión ya viven
          debajo de la columna derecha, así que acá no se repiten. */}
      {!hideChrome && !(live && sharing) && (
      <footer style={{ display: "flex", flexDirection: "column", gap: 8, position: "sticky", bottom: 0, paddingTop: 4, background: "var(--bg)" }}>
        {showSetup ? (
          <button
            onClick={() => {
              // Empresa y puesto son obligatorios: sin eso el Loro responde
              // genérico y la sesión no sirve. Se marcan los que falten y no
              // se avanza.
              if (!marcarFaltantes()) return;
              // Con pase se arranca derecho: no hay tipo de sesión que elegir.
              // Sin pase, se elige; y si ya no quedan gratis, `start` corta y
              // muestra el paywall.
              if (pass || sessionsUsedRef.current >= FREE_SESSIONS) {
                void start();
                return;
              }
              setShowSessionType(true);
              track("session_type_shown");
            }}
            disabled={connecting || passChecking}
            className="btn-action btn-primary"
          >
            {connecting ? "Conectando… 🦜" : "▶ Soltar el Loro (Crear Sesión)"}
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="clear-row">
              <button onClick={clearAll} className="clear-pill mono">
                ✕ Limpiar
              </button>
            </div>
            <button onClick={() => answerNow()} className="btn-action btn-primary btn-answer">
              <span className="btn-answer-inner">
                <SparkleIcon />
                Responder
              </span>
            </button>
          </div>
        )}
        {showSetup && savedCount > 0 && (
          <button type="button" className="cs-link-btn" onClick={() => setView("sessions")}>
            Ver mis sesiones ({savedCount}) →
          </button>
        )}
        {/* Canje manual del pase. Lo normal es entrar por el link, que lo canjea
            solo; esto es la red por si alguien copió solo el código. */}
        {showSetup &&
          (pass ? (
            <p className="pass-active">
              👑 Pase Rey Loro activo — {pass.email} · vence {fmtPassExpiry(pass.expiresAt)}
            </p>
          ) : passOpen ? (
            <form
              className="pass-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setPassBusy(true);
                const ok = await activatePass(passInput);
                setPassBusy(false);
                if (ok) {
                  setPassInput("");
                  setPassOpen(false);
                  track("pass_activated");
                }
              }}
            >
              <input
                className="form-input"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                placeholder="Pegá tu código o el link del pase"
                aria-label="Código o link de tu pase"
                autoFocus
              />
              <button
                type="submit"
                className="btn-action btn-primary btn-answer"
                disabled={!passInput.trim() || passBusy}
              >
                <span className="btn-answer-inner">{passBusy ? "Validando…" : "Activar"}</span>
              </button>
              {passError && <p className="paywall-error">{passError}</p>}
            </form>
          ) : (
            <>
              <button type="button" className="cs-link-btn" onClick={() => setPassOpen(true)}>
                ¿Ya sos Loro?
              </button>
              {/* Si el pase del link no validó, el error tiene que verse acá:
                  el formulario está cerrado, así que si no, abrir el link
                  parece "no hacer nada" y no hay pista de por qué. */}
              {passError && <p className="paywall-error">{passError}</p>}
            </>
          ))}
        {showSetup && (
          <p className="mono btn-hint">
            {mode === "mic"
              ? "Activá los parlantes (sin auriculares) para que el micrófono escuche al entrevistador."
              : "Elegí la pestaña del Meet y activá “Compartir audio de la pestaña”."}
          </p>
        )}
      </footer>
      )}

      {/* El paso de pago es su propia ventana, no un estado dentro del paywall:
          se llega tanto desde el paywall como desde el selector de tipo de
          sesión, y metido adentro de uno solo no aparecía desde el otro. */}
      {payPlan && (
        <PagoPaso plan={payPlan} onClose={() => setPayPlan(null)} onWhatsApp={openWhatsApp} />
      )}

      {showPaywall && !payPlan && (
        <div className="paywall-overlay" onClick={() => setShowPaywall(false)}>
          <div className="paywall paywall-wide" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="paywall-close"
              onClick={() => setShowPaywall(false)}
              aria-label="Cerrar"
            >
              ✕
            </button>
            {paywallReason === "capacity" ? (
              <>
                <div className="paywall-title">🛑 CUPOS AGOTADOS POR HOY</div>
                <p className="paywall-text">
                  Las APIs son caras y el acceso gratis se abre de a tandas para no fundirme.
                  El cupo de hoy ya se usó entero.
                </p>
                <p className="paywall-text paywall-cta">
                  Dejá tu email y te avisamos apenas abra la próxima tanda.
                </p>
                {emailSent ? (
                  <div className="paywall-sent">Enviado ✔ Te avisamos cuando abramos cupos.</div>
                ) : (
                  <div className="paywall-form">
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && submitWaitlist()}
                      placeholder="tu@email.com"
                      className="form-input"
                    />
                    <button
                      className="btn-action btn-primary"
                      onClick={submitWaitlist}
                      disabled={!email.trim() || sending}
                    >
                      {sending ? "Enviando…" : "Entregá al Loro"}
                    </button>
                    {emailError && <div className="paywall-error">{emailError}</div>}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Mismo lenguaje visual que el selector de tipo de sesión:
                    tarjetas neutras, el botón marca la jerarquía. */}
                <div className="paywall-title">🛑 Se te acabaron las sesiones gratis</div>
                <p className="paywall-text">
                  Ya viste cómo funciona. No vayas a tu entrevista real a ciegas. Usalo sin
                  restricciones.
                </p>

                <div className="stype-card">
                  <div className="stype-head">
                    <span className="stype-name">
                      <CardIcon /> Pase Rey Loro
                    </span>
                    <span className="stype-badge">{PASS_WEEK_PRICE}</span>
                  </div>
                  <p className="paywall-text">
                    Ilimitado por 7 días. Para la entrevista que tenés esta semana.
                  </p>
                  <button className="btn-action btn-primary" onClick={() => requestPass("week")}>
                    Entregá al Loro
                  </button>
                  <p className="paywall-fineprint">
                    Si no te sirve en tu entrevista, te devuelvo la plata. Sin volteretas.
                  </p>
                </div>

                <div className="stype-card">
                  <div className="stype-head">
                    <span className="stype-name">
                      <CalendarIcon /> Pase de 12 meses
                    </span>
                    <span className="stype-badge">{PASS_YEAR_PRICE}</span>
                  </div>
                  <p className="paywall-text">
                    🦜 ¿Búsqueda larga? Está a ese precio porque Loreado recién arranca y los
                    primeros que pagan son los que me van a decir qué arreglar. Cuando salga de
                    beta, los precios to the 🌙.
                  </p>
                  <button className="btn-action btn-outline" onClick={() => requestPass("year")}>
                    Internaron al Loro, Internaron al Loro, Internaron al Loro
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {celebrate && pass && <PassParty pass={pass} onDone={endCelebration} />}

      {/* Elección de tipo de sesión, antes de arrancar. A diferencia de
          Parakeet no hay créditos: lo que se vende es acceso ilimitado por
          tiempo, así que la opción paga abre el paso de pago y la gratis
          arranca la sesión. */}
      {showSessionType && !payPlan && (
        <div className="paywall-overlay" onClick={() => setShowSessionType(false)}>
          <div className="paywall paywall-wide" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="paywall-close"
              onClick={() => setShowSessionType(false)}
              aria-label="Cerrar"
            >
              ✕
            </button>
            <div className="paywall-title">Elegí tu tipo de sesión</div>
            <p className="paywall-text">
              Podés arrancar con un pase ilimitado o probar con una sesión gratis más corta.
            </p>

            <div className="stype-card">
              <div className="stype-head">
                <span className="stype-name">
                  <CardIcon /> Pase Rey Loro Ilimitado
                </span>
                <span className="stype-badge">7 días</span>
              </div>
              <p className="paywall-text">
                Sesiones sin límite de tiempo ni de cantidad durante 7 días, por {PASS_WEEK_PRICE}.
                Si no te sirve en tu entrevista, te devuelvo la plata.
              </p>
              <button className="btn-action btn-primary" onClick={() => requestPass("week")}>
                Entregá al Loro
              </button>
            </div>

            <div className="stype-card">
              <div className="stype-head">
                <span className="stype-name">
                  <ClockBigIcon /> Sesión gratis
                </span>
                <span className="stype-badge">
                  {sessionsLeft === 1 ? "queda 1" : `quedan ${sessionsLeft}`}
                </span>
              </div>
              <p className="paywall-text">
                Sesión de {SESSION_MAX_MIN} minutos, sin costo. Se corta sola al llegar al límite y
                no se extiende.
              </p>
              <button
                className="btn-action btn-outline"
                onClick={() => void start()}
                disabled={connecting || sessionsLeft <= 0}
              >
                {connecting ? "Conectando… 🦜" : "Activar sesión gratis"}
              </button>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}

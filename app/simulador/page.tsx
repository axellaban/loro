"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { track } from "../lib/track";
import Avatar, { type AvatarState } from "./Avatar";
import { TtsQueue, extractSentences } from "./tts";

type Line = { id: number; text: string; final: boolean };
type Lang = "es" | "en";
type Provider = "gemini" | "anthropic" | "openai";
type ModelOption = { id: string; label: string; provider: Provider; model: string; tag: string };

type InterviewType = "general" | "technical" | "behavioral" | "hr";

// Fases del turno de entrevista. El flujo es automático: el entrevistador
// habla (speaking), escucha (listening) y cierra la respuesta por silencio
// (confirming) sin que el usuario tenga que tocar nada.
type Phase =
  | "setup"
  | "connecting"
  | "asking"
  | "speaking"
  | "listening"
  | "confirming"
  | "feedback";

type HistoryItem = {
  question: string;
  answer: string;
};

type FeedbackQuestion = {
  question: string;
  answer: string;
  analysis: string;
  suggestion: string;
};

type FeedbackReport = {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  questions: FeedbackQuestion[];
};

const STT_LANG: Record<Lang, string> = { es: "es", en: "en" };

const MODELS: ModelOption[] = [
  { id: "gemini-flash", label: "Gemini 2.5 Flash", provider: "gemini", model: "gemini-2.5-flash", tag: "Recomendado" },
  { id: "gemini-flash-lite", label: "Gemini 2.5 Flash Lite", provider: "gemini", model: "gemini-2.5-flash-lite", tag: "Rápido" },
];
const DEFAULT_MODEL_ID = "gemini-flash";

// Provider Marks
function OpenAIMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#000" aria-hidden="true">
      <path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.07 6.07 0 0 0 4.98 4.18a5.98 5.98 0 0 0-3.99 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9A5.98 5.98 0 0 0 13.26 22a6.05 6.05 0 0 0 5.77-4.21 5.99 5.99 0 0 0 3.99-2.9 6.05 6.05 0 0 0-.75-7.07zm-9.02 12.6a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.79.79 0 0 0 .39-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.49 4.5zM3.6 18.3a4.47 4.47 0 0 1-.54-3.01l.14.09 4.78 2.76a.77.77 0 0 0 .78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.06L9.74 21a4.5 4.5 0 0 1-6.14-1.65zM2.34 7.9a4.48 4.48 0 0 1 2.34-1.97V11.6a.77.77 0 0 0 .39.68l5.82 3.36-2.02 1.17a.08.08 0 0 1-.07 0l-4.83-2.79A4.5 4.5 0 0 1 2.34 7.9zm16.6 3.86-5.84-3.39L15.11 7.2a.08.08 0 0 1 .07 0l4.83 2.78a4.49 4.49 0 0 1-.68 8.1v-5.68a.79.79 0 0 0-.39-.68zm2.01-3.02-.14-.09-4.77-2.78a.78.78 0 0 0-.79 0L9.42 7.24V4.91a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.66zM8.32 12.9 6.3 11.73a.08.08 0 0 1-.04-.06V6.1a4.5 4.5 0 0 1 7.38-3.45l-.14.08L8.72 5.49a.79.79 0 0 0-.39.68zm1.1-2.36L12 9.06l2.6 1.5v3l-2.6 1.5-2.6-1.5z" />
    </svg>
  );
}
function AnthropicMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" stroke="#CC785C" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
      <line x1="18.4" y1="5.6" x2="5.6" y2="18.4" />
    </svg>
  );
}
function GeminiMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}
function ProviderIcon({ provider }: { provider: Provider }) {
  return (
    <span className="dd-icon">
      {provider === "openai" ? <OpenAIMark /> : provider === "anthropic" ? <AnthropicMark /> : <GeminiMark />}
    </span>
  );
}

// Field icons
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
function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Info tip
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

// Dropdown component
type DDOption = {
  id: string;
  label: string;
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
          <span className="dd-trigger-label">{current?.label}</span>
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

function buildDgUrl(sttLang: string): string {
  const params = new URLSearchParams({
    model: "nova-2",
    language: sttLang,
    smart_format: "true",
    interim_results: "true",
    endpointing: "500",
    utterance_end_ms: "1000",
    vad_events: "true",
    encoding: "linear16",
    sample_rate: "16000",
    channels: "1",
  }).toString();
  return `wss://api.deepgram.com/v1/listen?${params}`;
}

function fmtElapsed(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const LS_KEY_CONTEXT = "simulador:context:v1";
const SESSIONS_KEY = "loreado:sessions:v1";
const BONUS_KEY = "loreado:bonus:v1";
const FREE_SESSIONS = 5;
const MAX_BONUS = 3;

// Umbral mínimo para considerar que hubo una respuesta real (evita cerrar el
// turno por un carraspeo transcripto).
const MIN_ANSWER_CHARS = 10;
// Countdown visible antes de cerrar la respuesta por silencio.
const CONFIRM_SECONDS = 2;

export default function SimuladorPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const phaseRef = useRef<Phase>("setup");
  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const [error, setError] = useState("");

  // Setup form states
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [profile, setProfile] = useState("");
  const [lang, setLang] = useState<Lang>("es");
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [interviewType, setInterviewType] = useState<InterviewType>("general");
  const [questionsCount, setQuestionsCount] = useState<number>(5);

  // Voz del entrevistador
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const mutedRef = useRef(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // Interview state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const historyRef = useRef<HistoryItem[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const questionRef = useRef("");
  const [lines, setLines] = useState<Line[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const currentAnswerRef = useRef("");
  const [confirmCountdown, setConfirmCountdown] = useState(CONFIRM_SECONDS);
  const [elapsed, setElapsed] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Feedback state
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [feedbackReport, setFeedbackReport] = useState<FeedbackReport | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Session limits (same system as /app)
  const [sessionsUsed, setSessionsUsed] = useState(0);
  const sessionsUsedRef = useRef(0);
  const [bonus, setBonus] = useState(0);
  const bonusRef = useRef(0);
  const freeSessions = FREE_SESSIONS + bonus;
  const sessionsLeft = Math.max(0, freeSessions - sessionsUsed);

  // Refs de audio / red
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const ttsRef = useRef<TtsQueue | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lineId = useRef(0);
  const sessionLangRef = useRef<Lang>("es");

  const intentionalCloseRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stabilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const wakeLockRef = useRef<any>(null);

  const selectedModel = MODELS.find((m) => m.id === modelId) || MODELS[0];

  // Los handlers del WebSocket viven entre renders: llaman a la versión fresca
  // de cada función de flujo a través de estos refs.
  const beginTurnRef = useRef<(h: HistoryItem[]) => void>(() => {});
  const closeAnswerRef = useRef<(auto: boolean) => void>(() => {});
  const dgMessageRef = useRef<(raw: string) => void>(() => {});
  const connectWsRef = useRef<(first: boolean) => Promise<void>>(async () => {});
  const scheduleReconnectRef = useRef<() => void>(() => {});

  // Load and save context
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY_CONTEXT);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.company) setCompany(saved.company);
      if (saved.role) setRole(saved.role);
      if (saved.profile) setProfile(saved.profile);
      if (saved.modelId && MODELS.some((m) => m.id === saved.modelId)) setModelId(saved.modelId);
      if (saved.lang === "es" || saved.lang === "en") setLang(saved.lang);
      if (saved.interviewType) setInterviewType(saved.interviewType);
      if (saved.questionsCount) setQuestionsCount(saved.questionsCount);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        LS_KEY_CONTEXT,
        JSON.stringify({ company, role, profile, modelId, lang, interviewType, questionsCount })
      );
    } catch {}
  }, [company, role, profile, modelId, lang, interviewType, questionsCount]);

  // Load session counter
  useEffect(() => {
    try {
      const n = parseInt(localStorage.getItem(SESSIONS_KEY) || "0", 10);
      const used = Number.isFinite(n) ? Math.max(0, n) : 0;
      sessionsUsedRef.current = used;
      setSessionsUsed(used);

      const b = parseInt(localStorage.getItem(BONUS_KEY) || "0", 10);
      const earned = Number.isFinite(b) ? Math.min(MAX_BONUS, Math.max(0, b)) : 0;
      bonusRef.current = earned;
      setBonus(earned);
    } catch {}
  }, []);

  // ---------- Timers del turno ----------

  const clearTurnTimers = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (confirmIntervalRef.current) {
      clearInterval(confirmIntervalRef.current);
      confirmIntervalRef.current = null;
    }
  };

  const enterListening = () => {
    currentAnswerRef.current = "";
    setCurrentAnswer("");
    setLines([]);
    setPhaseBoth("listening");
  };

  const enterConfirming = () => {
    clearTurnTimers();
    setPhaseBoth("confirming");
    let n = CONFIRM_SECONDS;
    setConfirmCountdown(n);
    confirmIntervalRef.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current);
        confirmIntervalRef.current = null;
        closeAnswerRef.current(true);
      } else {
        setConfirmCountdown(n);
      }
    }, 1000);
  };

  // ---------- Deepgram ----------

  const onDgMessage = (raw: string) => {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "UtteranceEnd") {
      if (phaseRef.current === "listening" && currentAnswerRef.current.trim().length >= MIN_ANSWER_CHARS) {
        enterConfirming();
      }
      return;
    }
    if (msg.type !== "Results") return;

    // Gating anti-eco: fuera de listening/confirming (avatar hablando o
    // pensando) cualquier transcript se descarta.
    const ph = phaseRef.current;
    if (ph !== "listening" && ph !== "confirming") return;

    const alt = msg.channel?.alternatives?.[0];
    const text: string = alt?.transcript || "";
    if (!text) return;
    const isFinal = !!msg.is_final;

    // Habla nueva durante el countdown → todavía no terminó: volver a escuchar.
    if (ph === "confirming") {
      clearTurnTimers();
      setPhaseBoth("listening");
    }

    setLines((prev) => {
      const next = [...prev];
      if (next.length && !next[next.length - 1].final) {
        next[next.length - 1] = { id: next[next.length - 1].id, text, final: isFinal };
      } else {
        next.push({ id: ++lineId.current, text, final: isFinal });
      }
      return next.slice(-40);
    });

    if (isFinal) {
      const acc = `${currentAnswerRef.current} ${text}`.trim();
      currentAnswerRef.current = acc;
      setCurrentAnswer(acc);
      // Respaldo por si Deepgram nunca emite UtteranceEnd: 1.6s sin habla
      // nueva después de un final dispara el cierre.
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (phaseRef.current === "listening" && currentAnswerRef.current.trim().length >= MIN_ANSWER_CHARS) {
          enterConfirming();
        }
      }, 1600);
    } else if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };
  dgMessageRef.current = onDgMessage;

  const scheduleReconnect = () => {
    if (intentionalCloseRef.current) return;
    const ph = phaseRef.current;
    if (ph === "setup" || ph === "feedback") return;
    if (reconnectAttemptsRef.current >= 3) {
      setError("Se perdió la conexión de audio. Podés finalizar y ver el feedback de lo respondido.");
      return;
    }
    const delay = 600 * 2 ** reconnectAttemptsRef.current;
    reconnectAttemptsRef.current += 1;
    reconnectTimerRef.current = setTimeout(() => {
      connectWsRef.current(false).catch(() => scheduleReconnectRef.current());
    }, delay);
  };
  scheduleReconnectRef.current = scheduleReconnect;

  const connectWs = async (first: boolean) => {
    const dgUrl = buildDgUrl(STT_LANG[sessionLangRef.current]);
    const tokRes = await fetch("/api/deepgram-token", { method: "POST" });
    if (!tokRes.ok) throw new Error("Error al obtener token de Deepgram.");
    const { token, scheme } = await tokRes.json();
    const ws = new WebSocket(dgUrl, [scheme || "token", token]);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      // Mientras el avatar habla no fluye PCM: sin KeepAlive Deepgram corta
      // el socket a ~10s de silencio.
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      keepAliveRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "KeepAlive" }));
      }, 7000);
      // Conexión estable 10s → renueva el presupuesto de reintentos.
      if (stabilityTimerRef.current) clearTimeout(stabilityTimerRef.current);
      stabilityTimerRef.current = setTimeout(() => {
        reconnectAttemptsRef.current = 0;
      }, 10_000);
      if (first) beginTurnRef.current([]);
    };
    ws.onmessage = (e) => {
      if (typeof e.data === "string") dgMessageRef.current(e.data);
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
      if (wsRef.current === ws) scheduleReconnectRef.current();
    };
  };
  connectWsRef.current = connectWs;

  // ---------- Turno: pregunta → voz → escucha ----------

  const beginTurn = async (currentHistory: HistoryItem[]) => {
    setPhaseBoth("asking");
    setCurrentQuestion("");
    questionRef.current = "";

    const ctx = audioCtxRef.current;
    if (!ctx) return;

    ttsRef.current?.stop();
    const queue = new TtsQueue(ctx, sessionLangRef.current);
    queue.setMuted(mutedRef.current);
    ttsRef.current = queue;
    setAnalyser(queue.analyser);

    let ttsFailed = false;
    queue.onStart = () => {
      if (phaseRef.current === "asking") setPhaseBoth("speaking");
    };
    queue.onError = () => {
      ttsFailed = true;
      track("sim_tts_error");
    };
    queue.onAllEnded = () => {
      // Si el TTS falló, dar tiempo a leer la pregunta en pantalla en vez de
      // pasar a escuchar de inmediato. El margen de 300ms deja drenar el
      // parlante antes de reabrir el mic (anti-eco).
      const delay = ttsFailed ? Math.max(1800, questionRef.current.length * 45) : 300;
      setTimeout(() => {
        if (phaseRef.current === "asking" || phaseRef.current === "speaking") enterListening();
      }, delay);
    };

    try {
      const res = await fetch("/api/simulador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "next-question",
          profile,
          company,
          role,
          interviewType,
          answerLang: sessionLangRef.current,
          provider: selectedModel.provider,
          model: selectedModel.model,
          history: currentHistory,
          questionIndex: currentHistory.length + 1,
          questionsCount,
        }),
      });
      if (!res.ok || !res.body) throw new Error("Error al obtener la pregunta.");
      track("sim_question_asked", { question_index: currentHistory.length + 1, model: selectedModel.model });

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let questionText = "";
      // Troceo incremental: cada oración completa entra a la cola TTS mientras
      // el LLM sigue streameando, para que la voz arranque con la primera.
      let pending = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        questionText += chunk;
        questionRef.current = questionText;
        setCurrentQuestion(questionText);

        pending += chunk;
        const { complete, rest } = extractSentences(pending);
        // Oraciones muy cortas ("Bien.") se fusionan con la siguiente para no
        // pagar un round-trip de TTS por dos palabras.
        let hold = "";
        for (const sentence of complete) {
          hold = hold ? `${hold} ${sentence}` : sentence;
          if (hold.length >= 25) {
            queue.enqueue(hold);
            hold = "";
          }
        }
        pending = hold ? `${hold} ${rest}` : rest;
      }
      if (pending.trim()) queue.enqueue(pending.trim());
      queue.finishInput();

      if (!questionText.trim()) throw new Error("El entrevistador no devolvió pregunta.");
    } catch (err: any) {
      queue.stop();
      endSession();
      setError(err?.message || "Error al conectar con la IA.");
    }
  };
  beginTurnRef.current = (h) => {
    void beginTurn(h);
  };

  const closeAnswer = (auto: boolean) => {
    const ph = phaseRef.current;
    if (ph !== "listening" && ph !== "confirming") return;
    clearTurnTimers();

    const answer = currentAnswerRef.current.trim();
    if (!answer) {
      setPhaseBoth("listening");
      return;
    }

    const updated = [...historyRef.current, { question: questionRef.current, answer }];
    historyRef.current = updated;
    setHistory(updated);
    currentAnswerRef.current = "";
    setCurrentAnswer("");
    setLines([]);
    track("sim_answer_closed", { auto, question_index: updated.length });

    if (updated.length >= questionsCount) {
      finishToFeedback(updated);
    } else {
      beginTurnRef.current(updated);
    }
  };
  closeAnswerRef.current = closeAnswer;

  // ---------- Fin de entrevista / feedback ----------

  const cleanupMedia = () => {
    intentionalCloseRef.current = true;
    clearTurnTimers();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (stabilityTimerRef.current) {
      clearTimeout(stabilityTimerRef.current);
      stabilityTimerRef.current = null;
    }
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    ttsRef.current?.stop();
    ttsRef.current = null;
    setAnalyser(null);
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
      }
      wsRef.current?.close();
    } catch {}
    try {
      workletRef.current?.disconnect();
    } catch {}
    try {
      audioCtxRef.current?.close();
    } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      wakeLockRef.current?.release();
    } catch {}
    wakeLockRef.current = null;
    wsRef.current = null;
    workletRef.current = null;
    audioCtxRef.current = null;
    streamRef.current = null;
    setCameraOn(false);
  };

  const finishToFeedback = (finalHistory: HistoryItem[]) => {
    cleanupMedia();
    track("sim_session_finished", { questions: finalHistory.length, duration_s: elapsedNow() });
    void fetchFeedback(finalHistory);
  };

  const elapsedNow = () =>
    startedAtRef.current ? Math.floor((Date.now() - startedAtRef.current) / 1000) : 0;

  // Botón "Finalizar": corta donde esté. Si hay al menos una respuesta (o una
  // en curso con contenido), va al feedback; si no, vuelve al setup.
  const endInterview = () => {
    const ph = phaseRef.current;
    if (ph === "listening" || ph === "confirming") {
      const a = currentAnswerRef.current.trim();
      if (a.length >= MIN_ANSWER_CHARS) {
        const updated = [...historyRef.current, { question: questionRef.current, answer: a }];
        historyRef.current = updated;
        setHistory(updated);
      }
    }
    if (historyRef.current.length > 0) {
      finishToFeedback(historyRef.current);
    } else {
      endSession();
      track("session_stopped");
    }
  };

  const endSession = () => {
    cleanupMedia();
    setPhaseBoth("setup");
  };

  const fetchFeedback = async (finalHistory: HistoryItem[]) => {
    setIsGeneratingFeedback(true);
    setPhaseBoth("feedback");
    try {
      const res = await fetch("/api/simulador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "feedback",
          profile,
          company,
          role,
          interviewType,
          answerLang: sessionLangRef.current,
          provider: selectedModel.provider,
          model: selectedModel.model,
          history: finalHistory,
        }),
      });
      if (!res.ok) throw new Error("No se pudo obtener el reporte de feedback.");
      const report: FeedbackReport = await res.json();
      setFeedbackReport(report);
      setIsGeneratingFeedback(false);
      track("sim_feedback_shown", { score: report?.score ?? 0 });
    } catch (err: any) {
      setIsGeneratingFeedback(false);
      setError(err?.message || "Error al procesar el feedback.");
    }
  };

  // ---------- Inicio de sesión ----------

  const startSimulation = async () => {
    if (sessionsUsedRef.current >= freeSessions) {
      setError("Beta pausada: Límite de sesiones gratuitas alcanzado.");
      track("sim_paywall_shown");
      return;
    }

    setError("");
    setHistory([]);
    historyRef.current = [];
    setLines([]);
    setCurrentAnswer("");
    currentAnswerRef.current = "";
    setCurrentQuestion("");
    questionRef.current = "";
    setFeedbackReport(null);
    setElapsed(0);
    setShowHistory(false);
    sessionLangRef.current = lang;
    intentionalCloseRef.current = false;
    reconnectAttemptsRef.current = 0;
    setPhaseBoth("connecting");

    try {
      // Un solo prompt de permisos con mic + cámara; si la cámara falla se
      // reintenta solo audio (la cámara es local y opcional, nunca se sube).
      const audioConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
      let stream: MediaStream;
      let camDenied = false;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: { facingMode: "user", width: { ideal: 640 } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        camDenied = true;
        track("sim_camera_denied");
      }
      streamRef.current = stream;
      setCameraOn(!camDenied && stream.getVideoTracks().length > 0);

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === "suspended") await audioCtx.resume();
      await audioCtx.audioWorklet.addModule("/pcm-worklet.js");

      const source = audioCtx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(audioCtx, "pcm-worklet");
      workletRef.current = worklet;

      worklet.port.onmessage = (e) => {
        // Gating anti-eco: solo fluye PCM cuando es el turno del usuario.
        const ph = phaseRef.current;
        if (ph !== "listening" && ph !== "confirming") return;
        const w = wsRef.current;
        if (w && w.readyState === WebSocket.OPEN) w.send(e.data);
      };
      source.connect(worklet);

      await connectWs(true);

      // Cuota
      const used = sessionsUsedRef.current + 1;
      sessionsUsedRef.current = used;
      setSessionsUsed(used);
      try {
        localStorage.setItem(SESSIONS_KEY, String(used));
      } catch {}
      track("sim_session_start", { model: selectedModel.model, questions: questionsCount, lang });

      // Wake lock: que no se apague la pantalla en el celular a mitad de entrevista.
      try {
        wakeLockRef.current = await (navigator as any).wakeLock?.request("screen");
      } catch {}

      startedAtRef.current = Date.now();
      timerIntervalRef.current = setInterval(() => setElapsed(elapsedNow()), 1000);
    } catch (err: any) {
      cleanupMedia();
      setError(err?.message || "No se pudo iniciar el simulador. Revisá los permisos de micrófono.");
      setPhaseBoth("setup");
    }
  };

  // Re-adquirir wake lock al volver de background durante la entrevista.
  useEffect(() => {
    const onVis = () => {
      const ph = phaseRef.current;
      if (document.visibilityState === "visible" && ph !== "setup" && ph !== "feedback") {
        (navigator as any).wakeLock
          ?.request("screen")
          .then((wl: any) => {
            wakeLockRef.current = wl;
          })
          .catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Conectar el stream de la cámara al <video> cuando el PiP está montado.
  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOn, phase]);

  // Cleanup al desmontar la página.
  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      cleanupMedia();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    const m = !isVoiceMuted;
    setIsVoiceMuted(m);
    mutedRef.current = m;
    ttsRef.current?.setMuted(m);
  };

  const copyOptimalAnswer = useCallback(
    (index: number, text: string) => {
      navigator.clipboard?.writeText(text).then(() => {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex((c) => (c === index ? null : c)), 1500);
        track("answer_copied", { model: selectedModel.model });
      });
    },
    [selectedModel]
  );

  const inInterview = phase !== "setup" && phase !== "feedback";
  const connecting = phase === "connecting";

  const avatarState: AvatarState =
    phase === "asking"
      ? "thinking"
      : phase === "speaking"
        ? "speaking"
        : phase === "listening" || phase === "confirming"
          ? "listening"
          : "idle";

  const statusLabel =
    phase === "connecting"
      ? "Conectando micrófono y cámara…"
      : phase === "asking"
        ? "El entrevistador está preparando la pregunta…"
        : phase === "speaking"
          ? "El entrevistador está hablando"
          : phase === "listening"
            ? "Te escuchamos — respondé hablando"
            : phase === "confirming"
              ? `¿Terminaste? Avanzando en ${confirmCountdown}…`
              : "";

  const interim = lines.length > 0 ? lines[lines.length - 1].text : "";
  const canFinishAnswer =
    (phase === "listening" || phase === "confirming") && currentAnswer.trim().length > 0;
  const isLastQuestion = history.length + 1 >= questionsCount;

  const historyPanel = (extraClass: string) => (
    <aside className={`sim-side-panel ${extraClass}`}>
      <div className="sim-side-title">Transcripción</div>
      {history.length === 0 ? (
        <p className="sim-history-empty">Acá van a aparecer tus respuestas a medida que avance la entrevista.</p>
      ) : (
        history.map((h, i) => (
          <div className="sim-history-item" key={i}>
            <div className="sim-history-q">
              P{i + 1}. {h.question}
            </div>
            <div className="sim-history-a">{h.answer}</div>
          </div>
        ))
      )}
    </aside>
  );

  return (
    <main className="app-container">
      {!inInterview && (
        <header className="brand-header">
          <div className="brand">
            <span className="brand-title">Loreado.IA 🦜</span>
            <span className="sim-badge">Simulador Beta</span>
          </div>
        </header>
      )}

      {phase === "setup" && (
        <>
          <p className="tagline">
            El Loro te entrevista cara a cara: te hace preguntas por voz, te escucha responder y al final te da un
            reporte de feedback completo. 🦜
          </p>

          <div className="selectors-row" style={{ marginTop: 8 }}>
            <div className="field">
              <label className="mono form-label">Idioma</label>
              <Dropdown
                value={lang}
                onChange={(id) => setLang(id as Lang)}
                ariaLabel="Idioma de la simulación"
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
                onChange={(id) => setModelId(id)}
                ariaLabel="Modelo de IA"
                alignRight
                options={MODELS.map((m) => ({
                  id: m.id,
                  label: m.label,
                  icon: <ProviderIcon provider={m.provider} />,
                  tag: m.tag === "Recomendado" ? undefined : m.tag,
                  badge: m.tag === "Recomendado" ? "Recomendado" : undefined,
                }))}
              />
            </div>
          </div>

          <div className="selectors-row" style={{ marginTop: 8 }}>
            <div className="field">
              <label className="mono form-label">Tipo de Entrevista</label>
              <Dropdown
                value={interviewType}
                onChange={(id) => setInterviewType(id as InterviewType)}
                ariaLabel="Tipo de Entrevista"
                options={[
                  { id: "general", label: "General / Fit Cultural" },
                  { id: "technical", label: "Técnica / Hard Skills" },
                  { id: "behavioral", label: "De Comportamiento (STAR)" },
                  { id: "hr", label: "Inicial / Recursos Humanos" },
                ]}
              />
            </div>
            <div className="field">
              <label className="mono form-label">Cantidad de Preguntas</label>
              <Dropdown
                value={String(questionsCount)}
                onChange={(id) => setQuestionsCount(Number(id))}
                ariaLabel="Cantidad de preguntas"
                alignRight
                options={[
                  { id: "3", label: "Corta (3 preguntas)" },
                  { id: "5", label: "Estándar (5 preguntas)" },
                  { id: "7", label: "Exhaustiva (7 preguntas)" },
                ]}
              />
            </div>
          </div>

          {error && <div className="mono sim-error-box" style={{ marginTop: 10 }}>⚠️ {error}</div>}

          <div className="panel" style={{ marginTop: 12 }}>
            <label className="mono form-label">Contexto del Puesto</label>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="mono form-mini-label">
                <BriefcaseIcon /> Empresa
                <InfoTip text="La empresa que simulará la entrevista. Ayuda a personalizar las preguntas y el fit." />
              </label>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ej: Mercado Libre"
                className="form-input"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
              <label className="mono form-mini-label">
                <DocIcon /> Descripción del puesto
                <InfoTip text="Descripción del rol para el que te simularás. Ayuda a definir las preguntas técnicas o de comportamiento." />
              </label>
              <textarea
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Pegá la descripción del puesto, seniority, requisitos o tecnologías."
                className="form-textarea form-textarea-sm"
              />
            </div>

            <label className="mono form-mini-label" style={{ marginTop: 4 }}>
              <UserIcon /> Tu perfil / CV
              <InfoTip text="Tu experiencia y habilidades. La IA las usará para hacer preguntas más específicas a tu caso o evaluar si aprovechás tu background." />
            </label>
            <textarea
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              placeholder="Pegá tu CV, experiencia previa o notas de tu perfil laboral."
              className="form-textarea"
            />
          </div>

          <footer style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <button onClick={() => void startSimulation()} className="btn-action btn-primary">
              ▶ Iniciar Entrevista (micrófono y cámara)
            </button>
            <p className="mono btn-hint" style={{ textAlign: "center" }}>
              La cámara es opcional y nunca sale de tu navegador. Se consumirá 1 sesión de tu cuota ({sessionsLeft}{" "}
              restantes).
            </p>
          </footer>
        </>
      )}

      {inInterview && (
        <div className="sim-live-grid">
          <div className="sim-live-header">
            <div className="sim-live-header-left">
              <span className="sim-rec-dot" aria-hidden="true" />
              <span className="sim-timer mono">{fmtElapsed(elapsed)}</span>
              <span className="sim-qcount">
                Pregunta {Math.min(history.length + 1, questionsCount)} de {questionsCount}
              </span>
            </div>
            <button className="sim-end-btn" onClick={endInterview}>
              Finalizar
            </button>
          </div>

          {error && <div className="mono sim-error-box">⚠️ {error}</div>}

          <div className="sim-stage">
            <Avatar state={avatarState} analyser={analyser} />

            {(currentQuestion || phase === "asking") && (
              <div className="sim-subtitle">
                {currentQuestion || (
                  <span className="sim-pulse-inline" aria-label="Preparando pregunta">
                    …
                  </span>
                )}
              </div>
            )}

            <div className="sim-pip">
              {cameraOn ? (
                <video ref={videoRef} muted playsInline autoPlay />
              ) : (
                <div className="sim-pip-off">
                  <span className="sim-pip-off-emoji">📷</span>
                  <span>Cámara desactivada</span>
                </div>
              )}
            </div>
          </div>

          <div className="sim-status-strip">
            <div className="sim-status-label">
              {(phase === "listening" || phase === "confirming") && <span className="sim-live-dot" aria-hidden="true" />}
              {statusLabel}
            </div>
            {(phase === "listening" || phase === "confirming") && interim && (
              <div className="sim-interim">{interim}</div>
            )}
          </div>

          <div className="sim-controls">
            <button className="sim-mute-btn" onClick={toggleMute} disabled={connecting}>
              {isVoiceMuted ? "🔇 Voz apagada" : "🔊 Voz"}
            </button>
            <button
              className="btn-action btn-primary"
              onClick={() => closeAnswerRef.current(false)}
              disabled={!canFinishAnswer}
            >
              {isLastQuestion ? "Terminé — Ver Feedback 🏆" : "Terminé mi respuesta →"}
            </button>
          </div>

          {historyPanel("sim-side-panel-desktop")}

          <button className="sim-history-toggle" onClick={() => setShowHistory((s) => !s)}>
            {showHistory ? "Ocultar transcripción" : "Ver transcripción"}
          </button>
          {showHistory && historyPanel("")}
        </div>
      )}

      {phase === "feedback" && (
        <div className="sim-feedback-container">
          {isGeneratingFeedback ? (
            <div className="sim-loading-feedback">
              <div className="sim-loading-spinner" />
              <h2 className="mono" style={{ fontSize: 16, fontWeight: 700 }}>Generando reporte de feedback…</h2>
              <p className="tagline" style={{ maxWidth: 360 }}>
                El Coach de IA está evaluando tus respuestas en base a la señal, fit cultural y claridad de
                comunicación. Esto demora unos segundos.
              </p>
            </div>
          ) : error && !feedbackReport ? (
            <div className="sim-loading-feedback">
              <div className="mono sim-error-box">⚠️ {error}</div>
              <button onClick={() => setPhaseBoth("setup")} className="btn-action btn-primary">
                Volver al inicio
              </button>
            </div>
          ) : (
            <>
              <div className="sim-score-circle-wrapper">
                <div className="sim-score-circle">{feedbackReport?.score ?? 0}</div>
                <div className="sim-score-label">PUNTAJE GENERAL</div>
              </div>

              <div className="sim-card">
                <div className="sim-card-header">📊 Resumen del Coach</div>
                <div className="sim-card-body">
                  <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--ink)" }}>{feedbackReport?.summary}</p>
                </div>
              </div>

              <div className="sim-columns-layout">
                <div className="sim-feedback-card" style={{ borderColor: "#a7f3d0" }}>
                  <div className="sim-feedback-card-title" style={{ color: "var(--loro-green-bright)" }}>
                    👍 Fortalezas
                  </div>
                  <ul className="sim-strengths-list">
                    {feedbackReport?.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="sim-feedback-card" style={{ borderColor: "#fde68a" }}>
                  <div className="sim-feedback-card-title" style={{ color: "#d97706" }}>
                    💡 Áreas de Mejora
                  </div>
                  <ul className="sim-improvements-list">
                    {feedbackReport?.improvements.map((imp, i) => (
                      <li key={i}>{imp}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <h3 className="mono" style={{ fontSize: 14, fontWeight: 700, marginTop: 12, color: "var(--loro-green-deep)" }}>
                ANÁLISIS PREGUNTA POR PREGUNTA
              </h3>

              <div>
                {feedbackReport?.questions.map((q, i) => (
                  <div key={i} className="sim-question-report-card">
                    <div className="sim-report-q-header">
                      Pregunta {i + 1}: {q.question}
                    </div>
                    <div className="sim-report-row">
                      <span className="sim-report-label">Tu Respuesta</span>
                      <p className="sim-report-val" style={{ color: "var(--ink-dim)" }}>{q.answer}</p>
                    </div>
                    <div className="sim-report-row">
                      <span className="sim-report-label">Análisis del Coach</span>
                      <p className="sim-report-val">{q.analysis}</p>
                    </div>
                    <div className="sim-report-row">
                      <span className="sim-report-label">Sugerencia del Loro (Cómo responder mejor)</span>
                      <div className="sim-report-val-suggestion">
                        <p>{q.suggestion}</p>
                        <button
                          className="sim-copy-suggested-btn"
                          onClick={() => copyOptimalAnswer(i, q.suggestion)}
                          aria-label="Copiar sugerencia"
                          title="Copiar sugerencia"
                        >
                          {copiedIndex === i ? <CheckIcon /> : <CopyIcon />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={() => setPhaseBoth("setup")} className="btn-action btn-primary" style={{ marginTop: 10 }}>
                🔄 Iniciar Nueva Simulación
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}

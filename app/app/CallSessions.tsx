"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "../lib/Markdown";
import { MODELS } from "../lib/models";
import { ProviderIcon } from "../lib/ProviderIcon";
import { track, identify } from "../lib/track";
import { rememberEmail, savedEmail } from "../lib/email";
import { useAuth, EntrarConGoogle } from "../lib/authClient";
import {
  fmtCardDate,
  fmtClock,
  fmtDuration,
  fmtLongDate,
  loadSessions,
  removeSession,
  sessionToText,
  updateSession,
  type CallSession,
  type ChatTurn,
} from "../lib/sessions";

// Pantalla a la que cae el copiloto cuando termina una sesión: la lista de
// sesiones pasadas, y por cada una una ficha con la transcripción completa,
// notas generadas a pedido y un chat sobre lo que pasó.

type Tab = "notes" | "transcript" | "ask" | "details";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "notes", label: "Notas IA" },
  { id: "transcript", label: "Transcripción" },
  { id: "ask", label: "Preguntar a la IA" },
  { id: "details", label: "Detalles" },
];

// Atajos del chat: los tres pedidos que más rinden sobre una entrevista ya
// terminada.
const SUGGESTIONS = [
  { label: "Email de seguimiento", prompt: "Escribime el email de seguimiento para mandar después de esta entrevista." },
  { label: "Puntuá la entrevista", prompt: "Puntuá cómo estuvieron mis respuestas del 1 al 10 y justificá con momentos concretos." },
  { label: "¿Cómo fue el clima?", prompt: "¿Cómo fue el clima de la conversación? ¿Qué señales dio el entrevistador sobre cómo la vio?" },
];

// ---------- Iconos ----------
function NotesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4a2 2 0 0 1 2-2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M15 2v5h5" />
      <path d="M8 12h6M8 16h4" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 4.9L19 9.8l-5.1 1.9L12 17l-1.9-5.3L5 9.8l5.1-1.9z" />
      <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.6v.2" />
    </svg>
  );
}
function BriefIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="7" width="19" height="13" rx="2.5" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
    </svg>
  );
}
function TranscriptIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M6.5 10h4M6.5 14h7M14.5 10h3" />
    </svg>
  );
}
function EraserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 20 3.5 15.5a2 2 0 0 1 0-2.8l8-8a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L13 20z" />
      <path d="M8 20h11" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 19h16" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function KebabIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}
function CopySmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M15 9V5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15H9" />
    </svg>
  );
}

const TAB_ICON: Record<Tab, () => React.JSX.Element> = {
  notes: NotesIcon,
  transcript: ChatIcon,
  ask: SparkIcon,
  details: InfoIcon,
};

function ModelCell({ modelId }: { modelId: string }) {
  const spec = MODELS.find((m) => m.id === modelId);
  return (
    <span className="cs-model-cell">
      {spec && <ProviderIcon provider={spec.provider} />}
      {spec?.label || modelId || "—"}
    </span>
  );
}

/**
 * Lee un stream de texto plano y va entregando lo acumulado. Es el mismo
 * protocolo que usa /api/answer, así que la UI no necesita parsear nada.
 */
async function readTextStream(res: Response, onChunk: (all: string) => void): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let acc = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    acc += decoder.decode(value, { stream: true });
    onChunk(acc);
  }
  return acc;
}

// ---------- Ficha de la lista ----------
function SessionCard({
  s,
  onOpen,
  onDelete,
}: {
  s: CallSession;
  onOpen: (tab: Tab) => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menu]);

  return (
    <article className="cs-card">
      <div className="cs-card-body">
        <div className="cs-card-top">
          <span className="cs-card-date">{fmtCardDate(s.createdAt)}</span>
          <div className="cs-kebab-wrap" ref={wrapRef}>
            <button
              type="button"
              className="cs-kebab"
              aria-label="Opciones de la sesión"
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
            >
              <KebabIcon />
            </button>
            {menu && (
              <div className="cs-kebab-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenu(false); onOpen("transcript"); }}>
                  Ver transcripción
                </button>
                <button type="button" role="menuitem" onClick={() => { setMenu(false); onOpen("details"); }}>
                  Detalles
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="cs-kebab-danger"
                  onClick={() => { setMenu(false); onDelete(); }}
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>

        <h3 className="cs-card-title">{s.company || "Sesión sin empresa"}</h3>
        <p className="cs-card-role">{s.role || "Sin puesto cargado"}</p>

        <div className="cs-chips">
          <span className="cs-chip"><BriefIcon /> Entrevista</span>
          <span className="cs-chip"><TranscriptIcon /> Transcripción</span>
        </div>
      </div>

      <div className="cs-card-foot">
        <div className="cs-card-foot-left">
          <span className="cs-status"><i className="cs-status-dot" /> Finalizada</span>
          <span className="cs-card-meta">
            {fmtDuration(s.durationMs)} <span className="cs-dot-sep">·</span> Sesión gratis
          </span>
        </div>
        {/* Dos salidas, no una. Antes el único botón era "Ver transcripción" y
            los chips también hablaban solo de eso: quien no había pasado por el
            informe no tenía forma de enterarse de que el análisis existía. */}
        <div className="cs-card-btns">
          <button type="button" className="cs-outline-btn" onClick={() => onOpen("transcript")}>
            Transcripción
          </button>
          <button type="button" className="cs-dark-btn cs-card-cta" onClick={() => onOpen("notes")}>
            {s.notes ? "Ver notas IA" : "Ver análisis"}
          </button>
        </div>
      </div>
    </article>
  );
}

/**
 * El muro del análisis, dentro de la ficha de la sesión.
 *
 * Existe por un caso concreto que apareció en producción: alguien termina la
 * entrevista, se salta la pantalla que pide el email, y más tarde entra por
 * "Ver mis sesiones". Ahí se encontraba con la transcripción y nada más —sin
 * ninguna señal de que el análisis existe—, así que ni sabía que se lo estaba
 * perdiendo ni cómo conseguirlo.
 *
 * Se nombra lo que falta antes de pedir nada: el que lee decide con la lista a
 * la vista, no a ciegas.
 */
function PanelDesbloqueo({ onListo }: { onListo: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const auth = useAuth();

  // Entrar con Google desbloquea igual: el email que devuelve está verificado,
  // así que vale más que uno tipeado, y es un click contra escribirlo entero.
  useEffect(() => {
    if (auth.cuenta?.email) {
      rememberEmail(auth.cuenta.email);
      onListo();
    }
  }, [auth.cuenta, onListo]);

  const enviar = async () => {
    const em = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setError("Poné un email válido.");
      return;
    }
    setEnviando(true);
    setError("");
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        rememberEmail(em);
        identify(em, { email: em });
        track("app_email_submit");
        onListo();
      } else {
        setError(j.error || "No se pudo enviar. Probá de nuevo.");
      }
    } catch {
      setError("Error de red. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="cs-empty cs-desbloqueo">
      <h4>Te falta la mitad de esta sesión 🦜</h4>
      <p>Ya tenés la transcripción. Lo que todavía no viste:</p>
      <ul className="cs-desbloqueo-lista">
        <li><span aria-hidden="true">🎯</span> Key Takeaways y Red Flags: qué hiciste bien y dónde la pifiaste.</li>
        <li><span aria-hidden="true">💬</span> Chat con la IA para repreguntar cómo responder mejor.</li>
      </ul>
      <div className="cs-desbloqueo-form">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          className="form-input"
          placeholder="tu@email.com"
          aria-label="Tu email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
        />
        <button type="button" className="cs-dark-btn" onClick={enviar} disabled={!email.trim() || enviando}>
          {enviando ? "Desbloqueando…" : "Desbloquear análisis →"}
        </button>
        {error && <p className="cs-error">{error}</p>}
        {auth.configurado && auth.listoGoogle && !auth.checking && (
          <EntrarConGoogle listo={auth.listoGoogle} className="entrar-google-centro" />
        )}
        {auth.error && <p className="cs-error">{auth.error}</p>}
      </div>
    </div>
  );
}

// ---------- Modal ----------
// Las notas NO se generan solas al abrir: cuestan tokens y no toda sesión que
// se abre se quiere resumir. La pestaña arranca vacía con su botón, y el gasto
// lo decide quien mira.
function SessionModal({
  session,
  initialTab,
  onClose,
  onPatch,
}: {
  session: CallSession;
  initialTab: Tab;
  onClose: () => void;
  onPatch: (patch: Partial<CallSession>) => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [notesDraft, setNotesDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [input, setInput] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const chat = session.chat || [];
  const notes = session.notes || "";

  /**
   * ¿Ya dejó el email (acá, en el gate del final o en el simulador)?
   *
   * Se lee en un efecto y no al inicializar el estado: el localStorage no
   * existe en el render del servidor, y calcularlo ahí haría que el HTML y el
   * primer render del navegador no coincidan.
   */
  const [desbloqueado, setDesbloqueado] = useState(true);
  useEffect(() => {
    setDesbloqueado(Boolean(savedEmail()));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Se aborta la generación en curso al cerrar: si no, el stream seguía
  // escribiendo sobre una sesión que ya no está en pantalla.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Con el modal abierto, la página de atrás no scrollea. En mobile los dos
  // scrolls compiten: el gesto sobre las notas terminaba moviendo el listado
  // de fichas y parecía que el panel estaba trabado.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.length, chatDraft]);

  const provider = useMemo(
    () => MODELS.find((m) => m.id === session.modelId)?.provider || "gemini",
    [session.modelId]
  );
  const apiModel = useMemo(
    () => MODELS.find((m) => m.id === session.modelId)?.model || "",
    [session.modelId]
  );

  const post = useCallback(
    (payload: Record<string, unknown>, signal: AbortSignal) =>
      fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          transcript: sessionToText(session),
          company: session.company,
          role: session.role,
          lang: session.lang,
          provider,
          model: apiModel,
          ...payload,
        }),
      }),
    [session, provider, apiModel]
  );

  const generateNotes = useCallback(async () => {
    setErr("");
    setBusy(true);
    setNotesDraft("");
    const controller = new AbortController();
    abortRef.current = controller;
    track("session_notes_generated");
    try {
      const res = await post({ action: "notes" }, controller.signal);
      if (!res.ok) {
        setErr(await res.text().catch(() => "No se pudieron generar las notas."));
        return;
      }
      const full = await readTextStream(res, setNotesDraft);
      if (full.trim()) onPatch({ notes: full.trim() });
      setNotesDraft("");
    } catch (e: any) {
      if (e?.name !== "AbortError") setErr("No se pudieron generar las notas.");
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [post, onPatch]);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setErr("");
      setInput("");
      setBusy(true);
      setChatDraft("");
      const history = chat;
      const next: ChatTurn[] = [...history, { role: "user", text: q }];
      onPatch({ chat: next });
      const controller = new AbortController();
      abortRef.current = controller;
      track("session_chat_message");
      try {
        const res = await post({ action: "chat", question: q, history }, controller.signal);
        if (!res.ok) {
          setErr(await res.text().catch(() => "No se pudo responder."));
          return;
        }
        const full = await readTextStream(res, setChatDraft);
        if (full.trim()) onPatch({ chat: [...next, { role: "assistant", text: full.trim() }] });
        setChatDraft("");
      } catch (e: any) {
        if (e?.name !== "AbortError") setErr("No se pudo responder.");
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, chat, onPatch, post]
  );

  const download = useCallback(() => {
    const blob = new Blob([sessionToText(session)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = (session.company || "sesion").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    a.download = `loreado-${slug || "sesion"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [session]);

  const copyAnswer = useCallback((i: number, text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(i);
        setTimeout(() => setCopied((c) => (c === i ? null : c)), 1200);
      },
      () => {}
    );
  }, []);

  // La transcripción se muestra en el orden en que pasó: las líneas del
  // entrevistador y las tarjetas de Q&A intercaladas por tiempo.
  const timeline = useMemo(() => {
    const items: Array<
      | { kind: "line"; ts: number; text: string; speaker: "interviewer" | "me" }
      | { kind: "qa"; ts: number; q: string; a: string; i: number }
    > = [
      // Sesiones viejas no tienen `speaker` (se guardaban antes de distinguir
      // quién habla): se tratan como entrevistador, que es lo único que había.
      ...session.lines.map((l) => ({ kind: "line" as const, ts: l.ts, text: l.text, speaker: l.speaker || "interviewer" })),
      ...session.qa.map((p, i) => ({ kind: "qa" as const, ts: p.ts, q: p.q, a: p.a, i })),
    ];
    return items.sort((a, b) => a.ts - b.ts);
  }, [session]);

  const title = TABS.find((t) => t.id === tab)?.label || "";

  return (
    <div className="cs-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Sesión con ${session.company || "sin empresa"}`}>
      <div className="cs-modal">
        <aside className="cs-side">
          <h2 className="cs-side-title">{session.company || "Sesión"}</h2>
          <p className="cs-side-role">{session.role || "Sin puesto"}</p>
          <nav className="cs-nav">
            {TABS.map((t) => {
              const Icon = TAB_ICON[t.id];
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`cs-nav-item ${tab === t.id ? "cs-nav-item-on" : ""}`}
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id}
                >
                  <Icon />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="cs-pane">
          <header className="cs-pane-head">
            <h3 className="cs-pane-title">{title}</h3>
            <div className="cs-pane-actions">
              {tab === "transcript" && (
                <>
                  <button type="button" className="cs-ghost-btn" onClick={download}>
                    <DownloadIcon /> Descargar
                  </button>
                </>
              )}
              {tab === "notes" && notes && (
                <button type="button" className="cs-ghost-btn" onClick={() => onPatch({ notes: "" })}>
                  <EraserIcon /> Borrar notas
                </button>
              )}
              {tab === "ask" && chat.length > 0 && (
                <button type="button" className="cs-ghost-btn" onClick={() => onPatch({ chat: [] })}>
                  <EraserIcon /> Borrar chat
                </button>
              )}
              <button type="button" className="cs-icon-btn" onClick={onClose} aria-label="Cerrar">
                <XIcon />
              </button>
            </div>
          </header>

          <div className="cs-pane-body">
            {err && <p className="cs-error">{err}</p>}

            {/* El aviso va ARRIBA de la transcripción, no al final: quien entra
                acá se pone a leer y no llega nunca al pie. */}
            {tab === "transcript" && !desbloqueado && timeline.length > 0 && (
              <div className="cs-lock-banner">
                <p>
                  <strong>Esto es solo la transcripción.</strong> El análisis de la IA —qué hiciste
                  bien, dónde la pifiaste y el chat para repreguntar— está sin desbloquear.
                </p>
                <button type="button" className="cs-dark-btn" onClick={() => setTab("notes")}>
                  Ver qué me falta →
                </button>
              </div>
            )}

            {tab === "transcript" &&
              (timeline.length === 0 ? (
                <div className="cs-empty">
                  <h4>No quedó transcripción de esta sesión</h4>
                  <p>La sesión terminó antes de que se transcribiera algo.</p>
                </div>
              ) : (
                <div className="cs-timeline">
                  {timeline.map((item, i) =>
                    item.kind === "line" ? (
                      <div
                        key={`l${i}`}
                        className={`cs-bubble-wrap ${item.speaker === "me" ? "cs-bubble-wrap-me" : ""}`}
                      >
                        <div className="cs-bubble">{item.text}</div>
                        <span className="cs-bubble-meta">
                          {item.speaker === "me" ? "Vos" : "Entrevistador"} · {fmtClock(item.ts)}
                        </span>
                      </div>
                    ) : (
                      <div key={`q${i}`} className="cs-qa">
                        <button
                          type="button"
                          className="cs-qa-copy"
                          onClick={() => copyAnswer(item.i, item.a)}
                          aria-label="Copiar respuesta"
                        >
                          {copied === item.i ? "copiado" : <CopySmallIcon />}
                        </button>
                        <p className="cs-qa-q">
                          <span aria-hidden="true">💬</span> <strong>Pregunta</strong>: {item.q}
                        </p>
                        <hr className="cs-qa-sep" />
                        <p className="cs-qa-a-label">
                          <span aria-hidden="true">⭐</span> <strong>Respuesta</strong>:
                        </p>
                        <Markdown text={item.a} className="cs-qa-a" />
                      </div>
                    )
                  )}
                </div>
              ))}

            {tab === "notes" &&
              (notes || notesDraft ? (
                <Markdown text={notes || notesDraft} className="cs-notes" />
              ) : busy ? (
                <div className="cs-empty">
                  {/* No repite "Analizando tu entrevista…", que es lo que dice
                      la pantalla al cerrar la sesión: son dos momentos
                      distintos y con el mismo texto parecen el mismo. */}
                  <h4>Escribiendo tus notas…</h4>
                  <p>El Loro está leyendo la transcripción completa.</p>
                </div>
              ) : !desbloqueado ? (
                <PanelDesbloqueo onListo={() => setDesbloqueado(true)} />
              ) : (
                <div className="cs-empty">
                  <h4>Todavía no generaste las notas</h4>
                  <p>Generalas ahora para repasar lo más importante de esta sesión.</p>
                  <button type="button" className="cs-dark-btn" onClick={generateNotes} disabled={busy}>
                    <SparkIcon /> {busy ? "Generando…" : "Generar notas IA"}
                  </button>
                </div>
              ))}

            {tab === "ask" && !desbloqueado && (
              <PanelDesbloqueo onListo={() => setDesbloqueado(true)} />
            )}

            {tab === "ask" && desbloqueado && (
              <div className="cs-chat">
                {chat.length === 0 && !chatDraft ? (
                  <div className="cs-empty">
                    <p>
                      Empezá el chat preguntando algo sobre la transcripción de la llamada.
                      <br />
                      Podés arrancar con estas sugerencias.
                    </p>
                    <div className="cs-suggestions">
                      {SUGGESTIONS.map((s) => (
                        <button key={s.label} type="button" className="cs-outline-btn" onClick={() => send(s.prompt)}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="cs-chat-log">
                    {chat.map((t, i) =>
                      t.role === "user" ? (
                        <div key={i} className="cs-chat-user">{t.text}</div>
                      ) : (
                        <Markdown key={i} text={t.text} className="cs-chat-ai" />
                      )
                    )}
                    {chatDraft && <Markdown text={chatDraft} className="cs-chat-ai" />}
                    {busy && !chatDraft && <p className="cs-chat-thinking mono">pensando…</p>}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>
            )}

            {tab === "details" && (
              <dl className="cs-details">
                <p className="cs-details-h">SESIÓN</p>
                <div className="cs-row"><dt>Tipo de sesión</dt><dd>Entrevista</dd></div>
                <div className="cs-row"><dt>Transcripción</dt><dd>{session.lines.length ? "Sí" : "No"}</dd></div>
                <div className="cs-row"><dt>Creada</dt><dd>{fmtLongDate(session.createdAt)}</dd></div>
                <div className="cs-row"><dt>Créditos usados</dt><dd>0</dd></div>
                <div className="cs-row"><dt>Duración</dt><dd>{fmtDuration(session.durationMs)}</dd></div>
                <hr className="cs-details-sep" />
                <p className="cs-details-h">IA</p>
                <div className="cs-row"><dt>Modelo</dt><dd><ModelCell modelId={session.modelId} /></dd></div>
                <div className="cs-row"><dt>Idioma</dt><dd>{session.lang === "en" ? "Inglés" : "Español"}</dd></div>
                <div className="cs-row"><dt>Respuestas generadas</dt><dd>{session.qa.length}</dd></div>
                <div className="cs-row"><dt>Captura</dt><dd>{session.mode === "tab" ? "Pestaña" : "Micrófono"}</dd></div>
              </dl>
            )}
          </div>

          {tab === "ask" && desbloqueado && (
            <form
              className="cs-composer"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <input
                className="cs-composer-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribí tu pregunta acá…"
                aria-label="Tu pregunta sobre la sesión"
              />
              <button type="submit" className="cs-dark-btn cs-send" disabled={busy || !input.trim()}>
                Enviar
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------- Pantalla ----------
export default function CallSessions({
  onNew,
  autoOpenId,
}: {
  onNew: () => void;
  /**
   * Sesión que se abre sola al entrar, en Notas IA y generándolas. Es lo que
   * se prometió a cambio del email: llegar y tener el informe, no una pantalla
   * con un botón para pedirlo.
   */
  autoOpenId?: string | null;
}) {
  const [sessions, setSessions] = useState<CallSession[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openTab, setOpenTab] = useState<Tab>("transcript");

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  useEffect(() => {
    if (!autoOpenId) return;
    setOpenTab("notes");
    setOpenId(autoOpenId);
  }, [autoOpenId]);

  // Se resuelve por id contra la lista, no se guarda el objeto: así el modal
  // siempre lee el estado recién persistido (notas, chat) y no una copia vieja.
  const open = sessions.find((s) => s.id === openId) || null;

  const patch = useCallback(
    (id: string, p: Partial<CallSession>) => setSessions(updateSession(id, p)),
    []
  );

  return (
    <div className="cs-screen">
      <header className="cs-header">
        <div>
          <h1 className="cs-title">Sesiones de llamada</h1>
          <p className="cs-sub">Preparate para tus llamadas y repasá las sesiones anteriores.</p>
        </div>
        <button type="button" className="cs-dark-btn cs-create" onClick={onNew}>
          <PlusIcon /> Crear Sesión
        </button>
      </header>

      {sessions.length === 0 ? (
        <div className="cs-empty cs-empty-screen">
          <h4>Todavía no hay sesiones</h4>
          <p>Cuando termines una sesión del copiloto, va a aparecer acá con su transcripción.</p>
          <button type="button" className="cs-dark-btn cs-create" onClick={onNew}>
            <PlusIcon /> Crear Sesión
          </button>
        </div>
      ) : (
        <div className="cs-grid">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              s={s}
              onOpen={(t) => {
                setOpenTab(t);
                setOpenId(s.id);
                track("session_card_opened");
              }}
              onDelete={() => setSessions(removeSession(s.id))}
            />
          ))}
        </div>
      )}

      {open && (
        <SessionModal
          session={open}
          initialTab={openTab}
          onClose={() => setOpenId(null)}
          onPatch={(p) => patch(open.id, p)}
        />
      )}
    </div>
  );
}

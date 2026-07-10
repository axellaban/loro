"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "connecting" | "live" | "error";
type Mode = "mic" | "tab";
type Line = { id: number; text: string; final: boolean };
type Answer = { id: number; question: string; text: string; done: boolean };

const DG_PARAMS = new URLSearchParams({
  model: "nova-2",
  language: "es",
  smart_format: "true",
  interim_results: "true",
  endpointing: "500",
  utterance_end_ms: "800",
  vad_events: "true",
  encoding: "linear16",
  sample_rate: "16000",
  channels: "1",
}).toString();
const DG_URL = `wss://api.deepgram.com/v1/listen?${DG_PARAMS}`;

const LS_KEY = "copiloto:context:v1";

export default function Page() {
  const [status, setStatus] = useState<Status>("idle");
  const [mode, setMode] = useState<Mode>("mic");
  const [error, setError] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [profile, setProfile] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [tab, setTab] = useState<"answer" | "transcript">("answer");

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const wakeLockRef = useRef<any>(null);
  const keepAliveRef = useRef<any>(null);

  const transcriptRef = useRef("");
  const questionBufRef = useRef(""); // acumula segmentos finales hasta el fin de utterance
  const lineId = useRef(0);
  const ansId = useRef(0);
  const genLock = useRef(false);

  const scrollT = useRef<HTMLDivElement | null>(null);
  const scrollA = useRef<HTMLDivElement | null>(null);

  // ---------- Detección iOS/Safari ----------
  // iOS Safari no soporta getDisplayMedia (captura de pestaña): solo mic.
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent || "";
    const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(iOS);
    if (iOS) setMode("mic");
  }, []);

  // iOS suspende el AudioContext al bloquear pantalla o cambiar de app.
  // Al volver, lo reactivamos y reintentamos el wake lock.
  useEffect(() => {
    const onResume = () => {
      if (document.visibilityState !== "visible") return;
      if (audioCtxRef.current?.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("pageshow", onResume);
    return () => {
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("pageshow", onResume);
    };
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
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ company, role, profile }));
    } catch {}
  }, [company, role, profile]);

  // ---------- Generación ----------
  const generate = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || q.length < 4 || genLock.current) return;
      genLock.current = true;
      const id = ++ansId.current;
      setAnswers((prev) => [{ id, question: q, text: "", done: false }, ...prev].slice(0, 20));
      setTab("answer");
      try {
        const res = await fetch("/api/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile,
            company,
            role,
            transcript: transcriptRef.current.slice(-4000),
            question: q,
          }),
        });
        if (!res.ok || !res.body) {
          setAnswers((prev) =>
            prev.map((a) => (a.id === id ? { ...a, text: "· Error generando respuesta.", done: true } : a))
          );
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
        setAnswers((prev) => prev.map((a) => (a.id === id ? { ...a, done: true } : a)));
      } catch {
        setAnswers((prev) =>
          prev.map((a) => (a.id === id ? { ...a, text: "· Error de red.", done: true } : a))
        );
      } finally {
        genLock.current = false;
      }
    },
    [profile, company, role]
  );

  const flushQuestion = useCallback(() => {
    const q = questionBufRef.current.trim();
    questionBufRef.current = "";
    if (q) generate(q);
  }, [generate]);

  // ---------- Mensajes Deepgram ----------
  const onDgMessage = useCallback(
    (raw: string) => {
      let msg: any;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      // Fin de intervención (silencio prolongado) -> disparo lo acumulado.
      if (msg.type === "UtteranceEnd") {
        flushQuestion();
        return;
      }
      if (msg.type !== "Results") return;

      const alt = msg.channel?.alternatives?.[0];
      const text: string = alt?.transcript || "";
      if (!text) return;
      const isFinal = !!msg.is_final;

      setLines((prev) => {
        const next = [...prev];
        if (next.length && !next[next.length - 1].final) {
          next[next.length - 1] = { id: next[next.length - 1].id, text, final: isFinal };
        } else {
          next.push({ id: ++lineId.current, text, final: isFinal });
        }
        return next.slice(-60);
      });

      if (isFinal) {
        transcriptRef.current += " " + text;
        questionBufRef.current += " " + text;
        // speech_final = Deepgram detectó fin de frase por endpointing.
        if (msg.speech_final) flushQuestion();
      }
    },
    [flushQuestion]
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
      s.getVideoTracks().forEach((t) => t.stop());
      return new MediaStream(at);
    }
    // mic
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  }, []);

  const start = useCallback(async () => {
    setError("");
    setStatus("connecting");
    questionBufRef.current = "";
    try {
      const tokRes = await fetch("/api/deepgram-token", { method: "POST" });
      if (!tokRes.ok) {
        const e = await tokRes.json().catch(() => ({}));
        throw new Error(e.error || "No se pudo obtener token de Deepgram.");
      }
      const { token } = await tokRes.json();

      const stream = await acquireStream(mode);
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === "suspended") await audioCtx.resume();
      await audioCtx.audioWorklet.addModule("/pcm-worklet.js");
      const source = audioCtx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(audioCtx, "pcm-worklet");
      workletRef.current = worklet;

      const ws = new WebSocket(DG_URL, ["token", token]);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("live");
        worklet.port.onmessage = (e) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(e.data);
        };
        source.connect(worklet);
        // Keepalive: Deepgram cierra tras ~10s de silencio sin datos.
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
        cleanup();
        if (event.code !== 1000 && event.code !== 1001) {
          setError(`Conexión cerrada por Deepgram (Código ${event.code}): ${event.reason || "Revisa tus credenciales o saldo en Deepgram"}`);
          setStatus("error");
        } else {
          setStatus((s) => (s === "error" ? s : "idle"));
        }
      };

      stream.getAudioTracks()[0].onended = () => stop();

      // Wake lock: evita que el celular apague la pantalla en modo mic.
      try {
        // @ts-ignore
        if (navigator.wakeLock) wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch {}
    } catch (err: any) {
      setError(err?.message || "Error al iniciar.");
      setStatus("error");
      cleanup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, acquireStream, onDgMessage]);

  const cleanup = useCallback(() => {
    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    keepAliveRef.current = null;
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
    cleanup();
    setStatus("idle");
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

  useEffect(() => {
    scrollT.current?.scrollTo({ top: scrollT.current.scrollHeight });
  }, [lines]);
  useEffect(() => {
    scrollA.current?.scrollTo({ top: 0 });
  }, [answers.length]);

  const live = status === "live";
  const connecting = status === "connecting";

  return (
    <main style={S.main}>
      <header style={S.header}>
        <div style={S.brand}>
          <span style={{ ...S.dot, ...(live ? S.dotLive : {}) }} />
          <span className="mono" style={S.brandText}>
            copiloto<span style={{ color: "var(--ink-faint)" }}>/es</span>
          </span>
        </div>
        <span className="mono" style={S.statusChip(status)}>
          {status === "idle" && "en espera"}
          {connecting && "conectando…"}
          {live && "en vivo"}
          {status === "error" && "error"}
        </span>
      </header>

      {!live && (
        <p className="mono" style={S.tagline}>
          Escucha la entrevista y te sugiere qué responder, en vivo.
        </p>
      )}

      {/* Selector de modo */}
      {!live && (
        <div style={{ ...S.modeRow, ...(isIOS ? S.modeRowSingle : {}) }}>
          <button
            className="mono"
            style={{ ...S.modeBtn, ...(mode === "mic" ? S.modeOn : {}) }}
            onClick={() => setMode("mic")}
            disabled={connecting}
          >
            🎙 Micrófono
            <span style={S.modeSub}>celular escuchando la sala</span>
          </button>
          {!isIOS && (
            <button
              className="mono"
              style={{ ...S.modeBtn, ...(mode === "tab" ? S.modeOn : {}) }}
              onClick={() => setMode("tab")}
              disabled={connecting}
            >
              🖥 Pestaña
              <span style={S.modeSub}>audio directo del Meet · desktop</span>
            </button>
          )}
        </div>
      )}
      {!live && isIOS && (
        <p className="mono" style={S.contextHint}>
          📱 En iPhone solo está disponible el modo micrófono — Safari no permite compartir el audio de una pestaña.
        </p>
      )}

      {error && (
        <div className="mono" style={S.errorBar}>
          {error}
        </div>
      )}

      {/* Contexto de la entrevista (solo antes de arrancar) */}
      {!live && (
        <div style={S.panel}>
          <label className="mono" style={S.label}>
            contexto de la entrevista
          </label>
          <div style={S.contextRow}>
            <div style={S.contextField}>
              <label className="mono" style={S.miniLabel}>
                empresa
              </label>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ej: Mercado Libre"
                style={S.input}
                disabled={connecting}
              />
            </div>
            <div style={S.contextField}>
              <label className="mono" style={S.miniLabel}>
                puesto / rol
              </label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Ej: Frontend Sr."
                style={S.input}
                disabled={connecting}
              />
            </div>
          </div>
          <label className="mono" style={{ ...S.miniLabel, marginTop: 4 }}>
            tu perfil / cv
          </label>
          <textarea
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            placeholder="Pegá tu CV, experiencia o notas. La respuesta se ancla en esto."
            style={S.textarea}
            disabled={connecting}
          />
          {(!company.trim() || !role.trim()) && (
            <p className="mono" style={S.contextHint}>
              Completá empresa y puesto para respuestas mejor dirigidas.
            </p>
          )}
        </div>
      )}

      {/* Tabs móviles */}
      {live && (
        <div style={S.tabsRow}>
          <button
            className="mono"
            style={{ ...S.tabBtn, ...(tab === "answer" ? S.tabOn : {}) }}
            onClick={() => setTab("answer")}
          >
            Respuestas
          </button>
          <button
            className="mono"
            style={{ ...S.tabBtn, ...(tab === "transcript" ? S.tabOn : {}) }}
            onClick={() => setTab("transcript")}
          >
            Transcripción
          </button>
        </div>
      )}

      {/* Contenido */}
      <section style={S.content}>
        {(!live || tab === "answer") && (
          <div style={{ ...S.panel, ...S.answerPanel }}>
            {!live && (
              <label className="mono" style={S.label}>
                respuestas sugeridas
              </label>
            )}
            <div ref={scrollA} style={S.answerBody}>
              {answers.length === 0 ? (
                <p style={S.placeholder}>
                  Cuando el entrevistador termine de preguntar, tu respuesta aparece acá en ~1-2s.
                </p>
              ) : (
                answers.map((a) => (
                  <div key={a.id} style={S.answerCard}>
                    <div className="mono" style={S.answerQ}>
                      {a.question}
                    </div>
                    <div style={S.answerText}>
                      {a.text || (
                        <span style={{ ...S.gen }} className="mono">
                          generando…
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {live && tab === "transcript" && (
          <div style={{ ...S.panel, ...S.answerPanel }}>
            <div ref={scrollT} style={S.transcript}>
              {lines.length === 0 ? (
                <p style={S.placeholder}>La transcripción aparece acá.</p>
              ) : (
                lines.map((l) => (
                  <p
                    key={l.id}
                    style={{ ...S.line, color: l.final ? "var(--ink)" : "var(--ink-dim)" }}
                  >
                    {l.text}
                  </p>
                ))
              )}
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer style={S.footer}>
        {!live ? (
          <button onClick={start} disabled={connecting} style={S.primaryBtn} className="mono">
            {connecting ? "conectando…" : mode === "mic" ? "▶ activar micrófono" : "▶ compartir pestaña"}
          </button>
        ) : (
          <button onClick={stop} style={S.stopBtn} className="mono">
            ■ detener
          </button>
        )}
        {!live && (
          <p className="mono" style={S.hint}>
            {mode === "mic"
              ? "Apoyá el celular cerca de los parlantes de la notebook."
              : "Elegí la pestaña del Meet y activá “Compartir audio de la pestaña”."}
          </p>
        )}
      </footer>
    </main>
  );
}

const S: Record<string, any> = {
  main: {
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    padding:
      "calc(14px + env(safe-area-inset-top)) 14px calc(14px + env(safe-area-inset-bottom))",
    gap: 12,
    maxWidth: 760,
    margin: "0 auto",
  },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  brand: { display: "flex", alignItems: "center", gap: 9 },
  brandText: { fontSize: 15, letterSpacing: "-0.02em", fontWeight: 600 },
  tagline: { fontSize: 12, color: "var(--ink-faint)", lineHeight: 1.4, marginTop: -4 },
  dot: { width: 9, height: 9, borderRadius: "50%", background: "var(--ink-faint)" },
  dotLive: { background: "var(--live)", boxShadow: "0 0 0 4px rgba(240,82,75,0.15)", animation: "pulse 1.6s ease-in-out infinite" },
  statusChip: (s: Status) => ({
    fontSize: 11.5,
    padding: "5px 11px",
    borderRadius: 999,
    border: "1px solid var(--line)",
    color: s === "live" ? "var(--accent)" : s === "error" ? "var(--live)" : "var(--ink-dim)",
    background: "var(--panel)",
  }),
  modeRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  modeRowSingle: { gridTemplateColumns: "1fr" },
  modeBtn: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    alignItems: "flex-start",
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: "12px 13px",
    color: "var(--ink-dim)",
    fontSize: 14,
    fontWeight: 600,
    textAlign: "left",
  },
  modeOn: { borderColor: "var(--accent)", color: "var(--ink)", background: "var(--panel-2)" },
  modeSub: { fontSize: 10.5, color: "var(--ink-faint)", fontWeight: 400, letterSpacing: 0 },
  errorBar: {
    fontSize: 12.5,
    color: "#ffb4b0",
    background: "rgba(240,82,75,0.08)",
    border: "1px solid rgba(240,82,75,0.3)",
    borderRadius: 8,
    padding: "10px 13px",
    lineHeight: 1.4,
  },
  panel: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: 13,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--ink-faint)",
  },
  textarea: {
    resize: "none",
    height: 110,
    background: "var(--panel-2)",
    border: "1px solid var(--line)",
    borderRadius: 8,
    color: "var(--ink)",
    padding: 10,
    fontSize: 16,
    lineHeight: 1.5,
    outline: "none",
  },
  contextRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  contextField: { display: "flex", flexDirection: "column", gap: 4 },
  miniLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--ink-faint)",
  },
  input: {
    background: "var(--panel-2)",
    border: "1px solid var(--line)",
    borderRadius: 8,
    color: "var(--ink)",
    padding: "9px 10px",
    fontSize: 16,
    outline: "none",
    width: "100%",
  },
  contextHint: { fontSize: 11, color: "var(--ink-faint)", lineHeight: 1.4 },
  tabsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  tabBtn: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "9px",
    color: "var(--ink-dim)",
    fontSize: 13,
    fontWeight: 600,
  },
  tabOn: { borderColor: "var(--accent)", color: "var(--ink)", background: "var(--panel-2)" },
  content: { flex: 1, minHeight: 0, display: "flex" },
  answerPanel: { flex: 1, minHeight: 0 },
  answerBody: {
    flex: 1,
    minHeight: 220,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  answerCard: {
    background: "var(--panel-2)",
    border: "1px solid var(--accent-dim)",
    borderRadius: 8,
    padding: 12,
  },
  answerQ: { fontSize: 11, color: "var(--ink-faint)", marginBottom: 7, lineHeight: 1.35 },
  answerText: { fontSize: 16.5, lineHeight: 1.65, whiteSpace: "pre-wrap", color: "var(--ink)" },
  gen: { fontSize: 12, color: "var(--accent)" },
  transcript: { flex: 1, minHeight: 220, overflowY: "auto", WebkitOverflowScrolling: "touch" },
  line: { fontSize: 14.5, lineHeight: 1.55, marginBottom: 6 },
  placeholder: { fontSize: 13, color: "var(--ink-faint)", lineHeight: 1.5, padding: 6 },
  footer: { display: "flex", flexDirection: "column", gap: 8, position: "sticky", bottom: 0 },
  primaryBtn: {
    background: "var(--accent)",
    color: "#08160d",
    border: "none",
    borderRadius: 10,
    padding: "15px",
    fontSize: 15,
    fontWeight: 800,
    width: "100%",
  },
  stopBtn: {
    background: "transparent",
    color: "var(--live)",
    border: "1px solid var(--live)",
    borderRadius: 10,
    padding: "15px",
    fontSize: 15,
    fontWeight: 800,
    width: "100%",
  },
  hint: { fontSize: 11.5, color: "var(--ink-faint)", textAlign: "center", lineHeight: 1.4 },
};

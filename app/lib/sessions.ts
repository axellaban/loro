// Historial de sesiones del copiloto, guardado en el navegador.
//
// No hay backend ni cuentas: el transcript de una entrevista es lo más
// sensible que maneja la app, así que vive en localStorage y no sale del
// dispositivo salvo cuando la persona pide notas o chatea con la IA (y ahí va
// solo el texto, sin identificadores).

export type QaPair = { q: string; a: string; ts: number };
export type ChatTurn = { role: "user" | "assistant"; text: string };

export type CallSession = {
  id: string;
  createdAt: number;
  /** Empresa y puesto tal como estaban cargados al arrancar la sesión. */
  company: string;
  role: string;
  durationMs: number;
  modelId: string;
  lang: "es" | "en";
  mode: "mic" | "tab";
  /**
   * Lo que se dijo, línea por línea. `speaker` falta en sesiones viejas
   * guardadas antes de distinguir quién habla: se tratan como entrevistador,
   * que es lo único que existía entonces.
   */
  lines: { text: string; ts: number; speaker?: "interviewer" | "me" }[];
  /** Cada pregunta detectada con la respuesta que generó el copiloto. */
  qa: QaPair[];
  /** Notas generadas a pedido (no se generan solas: cuestan tokens). */
  notes?: string;
  chat?: ChatTurn[];
};

const KEY = "loreado:callSessions:v1";
/**
 * Tope de sesiones guardadas. localStorage suele cortar en ~5 MB por origen y
 * una entrevista de 5 minutos deja unos pocos KB de texto, así que 30 entra
 * cómodo; el tope está para que el historial no crezca sin límite.
 */
const MAX_SESSIONS = 30;

export function loadSessions(): CallSession[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Más nuevas primero, que es el orden en que se muestran.
    return parsed.filter((s: any) => s && typeof s.id === "string").sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function persist(list: CallSession[]): CallSession[] {
  const trimmed = list.slice(0, MAX_SESSIONS);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // Cuota llena o storage bloqueado: se pierde el guardado, no la sesión en
    // curso. Nunca debe romper la UI.
  }
  return trimmed;
}

export function saveSession(session: CallSession): CallSession[] {
  const list = loadSessions().filter((s) => s.id !== session.id);
  return persist([session, ...list]);
}

export function updateSession(id: string, patch: Partial<CallSession>): CallSession[] {
  return persist(loadSessions().map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

export function removeSession(id: string): CallSession[] {
  return persist(loadSessions().filter((s) => s.id !== id));
}

// ---------- Formato ----------

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

/** "12 JUL 2026" — el encabezado de la ficha. */
export function fmtCardDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/** "12 jul 2026" — la fila de detalles. */
export function fmtLongDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MESES[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;
}

/** "07:22 p.m." — la marca de hora debajo de cada burbuja. */
export function fmtClock(ts: number): string {
  const d = new Date(ts);
  const h24 = d.getHours();
  const h = h24 % 12 || 12;
  const suffix = h24 < 12 ? "a.m." : "p.m.";
  return `${String(h).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${suffix}`;
}

/** Duración redondeada hacia arriba: una sesión de 12 s no es "0 min". */
export function fmtDuration(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60000));
  return `${mins} min`;
}

/**
 * El transcript en texto plano, que es a la vez lo que se descarga y lo que se
 * le manda a la IA. Que sea la MISMA función evita que el modelo lea algo
 * distinto de lo que ve la persona en pantalla.
 */
export function sessionToText(s: CallSession): string {
  const head = [
    `Sesión: ${s.company || "(sin empresa)"}${s.role ? ` — ${s.role}` : ""}`,
    `Fecha: ${fmtLongDate(s.createdAt)} ${fmtClock(s.createdAt)}`,
    `Duración: ${fmtDuration(s.durationMs)}`,
    "",
  ].join("\n");

  // Se intercalan por tiempo para que la IA lea la conversación en el orden en
  // que pasó, no primero todo el transcript y después todas las respuestas.
  const events: { ts: number; text: string }[] = [
    ...s.lines.map((l) => ({ ts: l.ts, text: `${l.speaker === "me" ? "Vos" : "Entrevistador"}: ${l.text}` })),
    ...s.qa.map((p) => ({ ts: p.ts, text: `Pregunta detectada: ${p.q}\nRespuesta sugerida: ${p.a}` })),
  ].sort((a, b) => a.ts - b.ts);

  return head + events.map((e) => e.text).join("\n\n");
}

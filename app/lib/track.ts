import { track as vercelTrack } from "@vercel/analytics";

// Wrapper de tracking a prueba de fallos: nunca rompe la UI si Analytics no
// está cargado (dev, adblock, etc.). Centraliza los nombres de evento del
// funnel para no tener strings sueltos por el código.
export type FunnelEvent =
  | "enter_app"
  | "session_start"
  | "answer_generated"
  | "answer_feedback"
  | "paywall_shown"
  | "waitlist_submit"
  | "share_whatsapp";

export function track(event: FunnelEvent, props?: Record<string, string | number | boolean>) {
  try {
    vercelTrack(event, props);
  } catch {
    // no-op
  }
}

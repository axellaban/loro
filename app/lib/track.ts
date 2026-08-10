import { track as vercelTrack } from "@vercel/analytics";
import posthog from "posthog-js";

// Wrapper de tracking a prueba de fallos: nunca rompe la UI si Analytics no
// está cargado (dev, adblock, etc.). Centraliza los nombres de evento del
// funnel para no tener strings sueltos por el código.
//
// Cada evento se manda a dos destinos: Vercel Analytics (en Hobby los eventos
// custom se descartan; quedan por si se pasa a Pro) y PostHog (el funnel real
// — se inicializa en AnalyticsClient solo si NEXT_PUBLIC_POSTHOG_KEY está).
export type FunnelEvent =
  | "enter_app"
  | "session_start"
  | "session_stopped"
  | "session_error"
  | "answer_requested"
  // Caminos manuales del copiloto: captura de pantalla y mensaje escrito.
  | "answer_screenshot"
  | "answer_screenshot_msg"
  | "answer_manual_msg"
  // Imagen subida desde el disco y adjuntada al mensaje escrito.
  | "answer_image_upload"
  | "answer_generated"
  | "answer_failed"
  | "answer_feedback"
  | "answer_copied"
  | "model_changed"
  | "lang_changed"
  | "answer_size_changed"
  | "auto_answer_toggled"
  | "save_transcript_toggled"
  | "session_saved"
  | "app_email_submit"
  | "session_card_opened"
  | "session_notes_generated"
  | "session_chat_message"
  | "mode_changed"
  // Captura de pestaña: si el micrófono propio quedó afuera y cambios de tab.
  | "mic_denied_on_tab"
  | "mic_connected"
  | "mic_disconnected"
  | "tab_switched"
  | "paywall_shown"
  | "capacity_closed_shown"
  | "waitlist_submit"
  | "share_whatsapp"
  | "vip_pass_click"
  // Elección de tipo de sesión y los dos pases ilimitados que la reemplazan.
  | "session_type_shown"
  // Ventana de "cómo conectar el audio", el paso previo a compartir la pestaña.
  | "connect_shown"
  | "pass_week_click"
  | "pass_year_click"
  | "pass_activated"
  // Login con Google y el pase que viaja con la cuenta.
  | "login_google"
  | "logout"
  | "pass_from_account"
  // Paso de pago: qué medio elige cada quien y quién vuelve con comprobante.
  | "pay_mp_week"
  | "pay_mp_year"
  | "pay_binance_week"
  | "pay_binance_year"
  | "pay_receipt_click"
  | "sim_session_start"
  | "sim_question_asked"
  | "sim_answer_closed"
  | "sim_tts_error"
  | "sim_camera_denied"
  | "sim_feedback_shown"
  | "sim_session_finished"
  | "sim_avatar_video_fallback"
  | "sim_camera_toggled"
  | "sim_mic_toggled"
  | "sim_cross_sell_click"
  | "sim_share_whatsapp"
  | "sim_email_submit"
  // Informe desbloqueado entrando con Google en vez de tipear el email.
  | "sim_google_unlock"
  | "hub_practice_click"
  | "hub_copilot_click";

/**
 * Qué eventos del funnel son CONVERSIONES para Google Ads, y con qué etiqueta.
 *
 * Google identifica cada conversión con "ID de conversión / etiqueta". El ID ya
 * viaja en el tag; las etiquetas las emite Ads al crear cada acción de
 * conversión y hay que pegarlas acá. Mientras un evento no tenga etiqueta no se
 * manda nada, y el resto del tracking sigue igual.
 *
 * El mapa vive acá y no en Ads a propósito: estos eventos ya se disparan en el
 * momento exacto del funnel, así que marcar uno como conversión es agregar un
 * renglón y no salir a buscar dónde engancharlo.
 *
 * Sobre cuáles conviene marcar:
 *  - `pass_activated` es la COMPRA de verdad, y ocurre en el sitio aunque el
 *    pago sea afuera: la persona canjea su código en la app. Con la ventana de
 *    90 días de Google, que pasen uno o dos días entre pagar y canjear no
 *    rompe la atribución.
 *  - `sim_email_submit` es el lead. Al arrancar conviene que sea la conversión
 *    principal: Google necesita volumen para optimizar y las compras van a ser
 *    pocas por mes.
 */
const CONVERSIONES: Partial<Record<FunnelEvent, string>> = {
  // "Compra" en Ads. OJO con el nombre: esto se dispara cuando alguien TOCA
  // "Pagar", no cuando paga. Entre una cosa y la otra hay un pago afuera y un
  // WhatsApp, así que el número va a ser más alto que las ventas reales.
  //
  // Se hace igual a propósito: al arrancar hay muy pocas ventas por mes y
  // Google necesita volumen para optimizar. Cuando haya ventas suficientes,
  // conviene mover esta etiqueta a `pass_activated` —el canje del código, que
  // sí ocurre en el sitio y sí es una compra— y dejar los clicks como una
  // acción aparte de "inicio de pago".
  pay_mp_week: "I-b6CNiZqN8cEOHJlL1E",
  pay_mp_year: "I-b6CNiZqN8cEOHJlL1E",
  pay_binance_week: "I-b6CNiZqN8cEOHJlL1E",
  pay_binance_year: "I-b6CNiZqN8cEOHJlL1E",
  // El lead: dejó su email para desbloquear el informe del simulador.
  //
  // En Ads la acción quedó configurada como "carga de página", pero eso no
  // aplica acá y no hace falta cambiarlo: el aviso no se manda al cargar
  // ninguna página, se manda cuando el envío del email SALIÓ BIEN. Configurado
  // por carga haría falta una página de gracias, y esa redirección no existe
  // —ni conviene, porque agrega un paso a un formulario de un solo campo.
  sim_email_submit: "RgtrCLL2qt8cEOHJlL1E",
  // El mismo lead por el otro camino: desbloquear el informe entrando con
  // Google. Es el mismo hecho —nos deja su email, y encima verificado— y no
  // contarlo dejaría afuera a quien elige el botón en vez del campo.
  sim_google_unlock: "RgtrCLL2qt8cEOHJlL1E",
  // pass_activated: "…",  ← la compra de verdad, para cuando haya volumen
};

const ADS_ID = (process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "AW-18381874401").trim();

/**
 * Avisa la conversión a Google Ads, si este evento es una.
 *
 * Nunca rompe: si el tag no cargó —bloqueador, red, deploy sin ID— queda en
 * nada, igual que los otros dos destinos de track().
 */
function ads(event: FunnelEvent, props?: Record<string, string | number | boolean>) {
  const etiqueta = CONVERSIONES[event];
  if (!etiqueta || !ADS_ID) return;
  try {
    const g = (window as any).gtag;
    if (typeof g !== "function") return;
    g("event", "conversion", {
      send_to: `${ADS_ID}/${etiqueta}`,
      // Con valor, Google puede optimizar por plata y no por cantidad. Solo se
      // manda si quien llama lo pasó: un número inventado ensucia el reporte.
      // Los pases están en dólares, así que la moneda es USD y no ARS.
      ...(typeof props?.value === "number" ? { value: props.value, currency: "USD" } : {}),
    });
  } catch {
    // no-op
  }
}

export function track(event: FunnelEvent, props?: Record<string, string | number | boolean>) {
  try {
    vercelTrack(event, props);
  } catch {
    // no-op
  }
  try {
    if (posthog.__loaded) posthog.capture(event, props);
  } catch {
    // no-op
  }
  ads(event, props);
}

// Liga el distinct_id anónimo actual a una identidad real (hoy, el único dato
// que tenemos es el email de la waitlist). A partir de acá los eventos previos
// y futuros de este navegador quedan bajo esa persona en PostHog.
export function identify(distinctId: string, props?: Record<string, string>) {
  try {
    if (posthog.__loaded) posthog.identify(distinctId, props);
  } catch {
    // no-op
  }
}

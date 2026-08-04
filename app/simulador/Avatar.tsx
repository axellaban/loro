"use client";

// Avatar del entrevistador: dos videos reales del loro superpuestos, uno
// hablando y otro escuchando, que se cruzan por opacidad.
//
// El clip de habla es el loro parloteando; el de espera se recortó de una
// ventana del mismo video donde el loro mira a cámara con el PICO CERRADO, en
// boomerang (directo + reverso) para que el loop no tenga costura. Así, mientras
// el usuario responde, el entrevistador no parece hablarle encima.
//
// Los dos clips corren siempre a velocidad normal y solo cambia la opacidad:
// nada de seeks, cambios de src ni playbackRate, que son las tres cosas que
// entrecortaban el video en intentos anteriores.
//
// El SVG animado queda como fallback si el video no puede cargar o reproducirse
// (y como placeholder mientras carga).

import { useEffect, useRef, useState } from "react";
import { track } from "../lib/track";
import { createLevelReader } from "./tts";

export type AvatarState = "idle" | "thinking" | "speaking" | "listening";

/**
 * Clips por viewport:
 *  - mobile: loro vertical (9/16) a pantalla completa.
 *  - desktop: la Lora entrevistadora horizontal (16/9), que llena el stage
 *    ancho sin recorte.
 *
 * En desktop hay TRES clips de habla y se van turnando: uno por pregunta, y
 * cuando se acaban vuelve a empezar. Con un solo clip repitiéndose toda la
 * entrevista, para la tercera pregunta ya se reconoce el gesto y el efecto de
 * "hay alguien del otro lado" se cae.
 *
 * El de espera es siempre el mismo: se recortó del primer clip de habla, del
 * tramo más quieto con el pico cerrado, en boomerang (ida y vuelta) para que
 * el bucle no tenga costura.
 */
const SOURCES = {
  mobile: { talks: ["/loro-interviewer.mp4"], idle: "/loro-idle.mp4" },
  desktop: {
    talks: ["/lora-talk-1-wide.mp4", "/lora-talk-2-wide.mp4", "/lora-talk-3-wide.mp4"],
    idle: "/lora-idle-wide-v5.mp4",
  },
};

// Debe coincidir con la transición de `.sim-avatar-video` en globals.css.
const FADE_MS = 450;

export default function Avatar({
  state,
  analyser,
  micAnalyser = null,
}: {
  state: AvatarState;
  analyser: AnalyserNode | null;
  /** Nivel del micrófono del usuario: hace latir el anillo mientras responde. */
  micAnalyser?: AnalyserNode | null;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const talkRef = useRef<HTMLVideoElement | null>(null);
  const idleRef = useRef<HTMLVideoElement | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  /**
   * `null` hasta que el componente monta en el navegador, y recién ahí mobile
   * o desktop.
   *
   * Antes esto se resolvía en el primer render leyendo `window`, para no montar
   * los clips verticales en desktop ni por un instante. El problema: esta
   * página también se renderiza en el servidor, donde `window` no existe y la
   * respuesta era siempre "mobile". En mobile daba igual —servidor y navegador
   * coincidían—, pero en DESKTOP el servidor mandaba un `<video>` con los clips
   * verticales y el navegador esperaba los horizontales. Como los dos videos
   * llevan `key`, React se encontraba con elementos distintos a los que había
   * pintado e hidrataba mal justo ese pedazo: el avatar quedaba clavado en el
   * clip de espera y el de habla no aparecía nunca.
   *
   * Con `null` los dos primeros renders coinciden (no hay video, se ve el SVG),
   * y los clips correctos entran después. Un frame de SVG a cambio de que el
   * avatar funcione.
   */
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 880px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const montado = isDesktop !== null;
  const { talks, idle: idleSrc } = isDesktop ? SOURCES.desktop : SOURCES.mobile;

  /**
   * Cuál de los clips de habla toca. Avanza al TERMINAR cada turno, no al
   * empezar el siguiente: así el clip que viene tiene toda la pausa —mientras
   * la persona responde— para descargarse, y cuando le toca hablar ya está
   * listo. Al revés habría que esperarlo justo cuando hace falta.
   */
  const [talkIdx, setTalkIdx] = useState(0);
  const talkSrc = talks[talkIdx % talks.length];
  const speaking = state === "speaking";

  // Pasar al siguiente clip cuando se termina de hablar.
  const hablabaAntes = useRef(false);
  useEffect(() => {
    if (hablabaAntes.current && !speaking && talks.length > 1) {
      setTalkIdx((i) => (i + 1) % talks.length);
    }
    hablabaAntes.current = speaking;
  }, [speaking, talks.length]);

  // Al cambiar de fuente (cruce de breakpoint) los <video> se remontan por la
  // key, pero `videoReady` es del componente: sin este reset se mostraría el
  // frame viejo hasta que el clip nuevo dispare su propio onCanPlay.
  useEffect(() => {
    setVideoReady(false);
  }, [idleSrc]);

  const failVideo = () => {
    setVideoFailed((prev) => {
      if (!prev) track("sim_avatar_video_fallback");
      return true;
    });
  };

  // El clip de espera corre siempre; el de habla solo mientras habla. Pausarlo
  // recién después del cross-fade evita que se congele a la vista, y retomarlo
  // no implica seek (sigue bufferizado), así que no reintroduce el tirón.
  useEffect(() => {
    if (videoFailed) return;
    const talk = talkRef.current;
    const idle = idleRef.current;
    idle?.play().catch(() => {});
    if (speaking) {
      talk?.play().catch(() => {
        if (talk.currentTime === 0) failVideo();
      });
      return;
    }
    const timer = setTimeout(() => talk?.pause(), FADE_MS + 150);
    return () => clearTimeout(timer);
  }, [speaking, videoFailed, talkSrc, idleSrc]);


  // El anillo late con la voz real del usuario. Solo en `listening`: así no
  // reacciona al TTS del propio loro filtrándose por el micrófono (eco).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (state !== "listening" || !micAnalyser) {
      el.style.setProperty("--mic", "0");
      return;
    }
    const readLevel = createLevelReader(micAnalyser);
    let raf = 0;
    const tick = () => {
      el.style.setProperty("--mic", readLevel().toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.style.setProperty("--mic", "0");
    };
  }, [state, micAnalyser]);

  const showVideo = montado && !videoFailed && videoReady;


  return (
    <div
      ref={rootRef}
      className={`sim-avatar sim-avatar-${state} ${micAnalyser ? "sim-avatar-mic" : ""}`}
    >
      <div className="sim-avatar-ring" aria-hidden="true" />
      {montado && !videoFailed && (
        <>
          {/* Espera: loop en boomerang, pico cerrado. Es el estado por defecto,
              así que va abajo y el de habla se funde encima. */}
          <video
            ref={idleRef}
            key={idleSrc}
            className={`sim-avatar-video ${speaking ? "sim-avatar-video-off" : ""} ${
              showVideo ? "" : "sim-avatar-video-hidden"
            }`}
            src={idleSrc}
            muted
            playsInline
            loop
            autoPlay
            preload="auto"
            onCanPlay={() => setVideoReady(true)}
            onError={failVideo}
            aria-hidden="true"
          />
          <video
            ref={talkRef}
            key={talkSrc}
            className={`sim-avatar-video ${speaking ? "" : "sim-avatar-video-off"} ${
              showVideo ? "" : "sim-avatar-video-hidden"
            }`}
            src={talkSrc}
            muted
            playsInline
            loop
            /**
             * Arranca solo, aunque todavía no se vea (está en opacidad 0).
             *
             * Antes solo tenía `preload="auto"`, que es una sugerencia: Chrome
             * le baja la prioridad a un video que nunca se reprodujo, así que
             * este clip —2,6 MB contra los 183 KB del de espera— recién salía a
             * bajarse cuando el loro empezaba a hablar. Si tardaba más que el
             * turno, no se lo veía moverse nunca y quedaba a la vista el de
             * espera. Reproducirlo desde el arranque lo deja decodificado y
             * listo; el efecto de abajo lo pausa después del cross-fade, y
             * retomarlo ya no cuesta nada.
             */
            autoPlay
            preload="auto"
            onCanPlay={() => setVideoReady(true)}
            onError={failVideo}
            aria-hidden="true"
          />
        </>
      )}
      {!showVideo && (
        <div className="sim-avatar-circle">
          <FallbackSvg state={state} analyser={analyser} />
        </div>
      )}
      {state === "thinking" && (
        <div className="sim-thinking-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
      <Diagnostico state={state} talkRef={talkRef} idleRef={idleRef} showVideo={showVideo} videoFailed={videoFailed} />
    </div>
  );
}

/**
 * Lo que está pasando adentro del avatar, en pantalla.
 *
 * Se enciende con `?debug=1` y no existe para nadie más. Está acá porque el
 * avatar se rompe también en mobile, donde no hay consola que mirar, y porque
 * el bug no se puede reproducir sin una entrevista real con audio: sin esto,
 * cada intento de arreglo es una adivinanza que hay que ir a probar afuera.
 *
 * Responde las tres preguntas que separan las causas posibles: si llega el
 * estado "speaking", si el clip de habla está corriendo, y si avanza.
 */
function Diagnostico({
  state,
  talkRef,
  idleRef,
  showVideo,
  videoFailed,
}: {
  state: AvatarState;
  talkRef: React.RefObject<HTMLVideoElement | null>;
  idleRef: React.RefObject<HTMLVideoElement | null>;
  showVideo: boolean;
  videoFailed: boolean;
}) {
  const [on, setOn] = useState(false);
  const [linea, setLinea] = useState("");

  useEffect(() => {
    try {
      setOn(new URLSearchParams(window.location.search).get("debug") === "1");
    } catch {}
  }, []);

  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => {
      const t = talkRef.current;
      const i = idleRef.current;
      const seVe = (el: HTMLVideoElement | null) =>
        el ? Number(getComputedStyle(el).opacity).toFixed(1) : "—";
      setLinea(
        `estado: ${state}\n` +
          `habla: ${t ? (t.paused ? "PAUSADO" : "corriendo") : "sin elemento"} ` +
          `t=${t ? t.currentTime.toFixed(1) : "—"} op=${seVe(t)}\n` +
          `espera: ${i ? (i.paused ? "PAUSADO" : "corriendo") : "sin elemento"} ` +
          `t=${i ? i.currentTime.toFixed(1) : "—"} op=${seVe(i)}\n` +
          `video listo: ${showVideo ? "sí" : "no"} · falló: ${videoFailed ? "sí" : "no"}`
      );
    }, 400);
    return () => clearInterval(id);
  }, [on, state, talkRef, idleRef, showVideo, videoFailed]);

  if (!on) return null;
  return <pre className="sim-avatar-debug">{linea}</pre>;
}

// SVG del loro de marca (derivado de app/lib/parrot.tsx) con lip-sync por
// AnalyserNode y parpadeo. Solo se ve si el video falla o aún no cargó.
function FallbackSvg({ state, analyser }: { state: AvatarState; analyser: AnalyserNode | null }) {
  const rootRef = useRef<SVGSVGElement | null>(null);

  // Lip-sync: rAF que vuelca el nivel RMS del TTS en la CSS var --mouth (0–1).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (state !== "speaking" || !analyser) {
      el.style.setProperty("--mouth", "0");
      return;
    }
    const readLevel = createLevelReader(analyser);
    let raf = 0;
    const tick = () => {
      el.style.setProperty("--mouth", readLevel().toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.style.setProperty("--mouth", "0");
    };
  }, [state, analyser]);

  // Parpadeo con cadencia aleatoria.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    let unblink: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        el.classList.add("sim-blink");
        unblink = setTimeout(() => {
          el.classList.remove("sim-blink");
          schedule();
        }, 140);
      }, 2500 + Math.random() * 3500);
    };
    schedule();
    return () => {
      clearTimeout(timer);
      clearTimeout(unblink);
    };
  }, []);

  return (
    <svg
      ref={rootRef}
      className="sim-avatar-svg"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Plumas de cola */}
      <path d="M40 74 L18 100 L30 94 L44 84 Z" fill="#a3e635" />
      <path d="M48 78 L30 104 L44 96 L54 86 Z" fill="#22d3ee" />
      {/* Cuerpo y panza */}
      <path
        d="M58 40 C84 40 90 66 82 86 C76 100 56 102 46 90 C38 80 38 60 44 50 C48 44 52 40 58 40 Z"
        fill="#10b981"
      />
      <path d="M62 56 C74 56 78 72 72 84 C68 92 58 92 54 84 C50 74 52 58 62 56 Z" fill="#34d399" />
      {/* Cabeza (grupo para inclinación en listening) */}
      <g className="sim-head">
        <circle cx="62" cy="36" r="24" fill="#10b981" />
        {/* Cresta */}
        <path d="M60 12 C58 4 66 3 66 11 C70 3 76 7 72 15 Z" fill="#22d3ee" />
        <path d="M68 12 C68 4 76 6 73 14 Z" fill="#fbbf24" />
        {/* Ojo con párpado */}
        <circle cx="58" cy="38" r="14" fill="#ecfdf5" />
        <g className="sim-eye">
          <circle cx="59" cy="34" r="6.5" fill="#0a0a0f" />
          <circle cx="61" cy="32" r="2.2" fill="#ffffff" />
        </g>
        <ellipse className="sim-eyelid" cx="58" cy="38" rx="14.5" ry="14.5" fill="#10b981" />
        {/* Pico superior */}
        <path
          className="sim-beak-upper"
          d="M44 34 C31 32 29 44 41 47 C48 48 51 46 53 41 C53 36 50 34 44 34 Z"
          fill="#f59e0b"
        />
        {/* Mandíbula inferior: rota alrededor de la comisura para el lip-sync */}
        <path className="sim-beak-lower" d="M41 47 C38 54 48 57 50 48 Z" fill="#d97706" />
      </g>
    </svg>
  );
}

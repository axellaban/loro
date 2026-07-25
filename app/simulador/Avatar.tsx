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

// Un par de clips por viewport:
//  - mobile: loro vertical (9/16) a pantalla completa.
//  - desktop: loro horizontal (16/9) que llena el stage ancho sin recorte.
const SOURCES = {
  mobile: { talk: "/loro-interviewer.mp4", idle: "/loro-idle.mp4" },
  desktop: { talk: "/loro-interviewer-wide.mp4", idle: "/loro-idle-wide.mp4" },
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
  // Se calcula sincrónicamente en el primer render (no en un efecto posterior)
  // para no montar nunca los clips verticales de arranque en desktop.
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 880px)").matches
  );

  // Recalculamos si el usuario cruza el breakpoint (resize / rotación).
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 880px)");
    const update = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const { talk: talkSrc, idle: idleSrc } = isDesktop ? SOURCES.desktop : SOURCES.mobile;
  const speaking = state === "speaking";

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

  const showVideo = !videoFailed && videoReady;

  return (
    <div
      ref={rootRef}
      className={`sim-avatar sim-avatar-${state} ${micAnalyser ? "sim-avatar-mic" : ""}`}
    >
      <div className="sim-avatar-ring" aria-hidden="true" />
      {!videoFailed && (
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
            preload="auto"
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
    </div>
  );
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

"use client";

// Avatar del entrevistador: video real del loro (public/loro-interviewer.mp4).
// El video reproduce SIEMPRE en loop: a ritmo normal cuando habla (`speaking`)
// y ralentizado el resto del tiempo, para que el loro se vea vivo mientras
// piensa/escucha en lugar de quedar congelado. El SVG animado queda como
// fallback si el video no puede cargar o reproducirse (y como placeholder
// mientras carga).

import { useEffect, useRef, useState } from "react";
import { track } from "../lib/track";
import { createLevelReader } from "./tts";

export type AvatarState = "idle" | "thinking" | "speaking" | "listening";

// Estado de espera (no hablando): en vez de un loop hacia adelante que corta al
// reiniciar, hacemos un vaivén sutil (ping-pong) de una ventana corta del video,
// oscilando currentTime con easing seno para que sea smooth y sin cortes.
// En espera, ancla el vaivén en una "pose de escucha": primer plano del loro
// mirando fijo a cámara con el pico cerrado (t≈7.5–8.0s del video, identificado
// frame a frame). Al terminar de hablar, salta ahí y se mueve muy poquito, para
// acentuar el efecto "te miro y espero que respondas".
const IDLE_ANCHOR = 7.5; // segundo del video donde arranca el vaivén de espera
const IDLE_WINDOW = 0.3; // segundos que recorre el vaivén (movimiento sutil)
const IDLE_PERIOD = 3000; // ms de un ciclo completo (ida y vuelta), lento y calmo

export default function Avatar({
  state,
  analyser,
}: {
  state: AvatarState;
  analyser: AnalyserNode | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const failVideo = () => {
    setVideoFailed((prev) => {
      if (!prev) track("sim_avatar_video_fallback");
      return true;
    });
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v || videoFailed) return;

    // Hablando: reproducción normal hacia adelante.
    if (state === "speaking") {
      v.playbackRate = 1;
      v.play().catch(() => {
        if (v.currentTime === 0) failVideo();
      });
      return;
    }

    // Esperando: pausamos la reproducción nativa y movemos currentTime en un
    // vaivén suave (0→1→0 con coseno) sobre una ventana corta, en loop.
    let raf = 0;
    let startTs = 0;
    let base = 0;
    let stopped = false;

    const tick = (now: number) => {
      if (stopped) return;
      if (!startTs) startTs = now;
      const t = ((now - startTs) % IDLE_PERIOD) / IDLE_PERIOD; // 0..1
      const phase = (1 - Math.cos(t * Math.PI * 2)) / 2; // 0→1→0 suave
      try {
        v.currentTime = base + phase * IDLE_WINDOW;
      } catch {}
      raf = requestAnimationFrame(tick);
    };

    const begin = () => {
      if (stopped) return;
      const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 10;
      // Saltamos a la pose de escucha y anclamos ahí, sin pasarnos del final.
      base = Math.min(IDLE_ANCHOR, Math.max(0, dur - IDLE_WINDOW));
      try {
        v.currentTime = base;
      } catch {}
      v.pause();
      raf = requestAnimationFrame(tick);
    };

    if (v.readyState >= 1) begin();
    else v.addEventListener("loadedmetadata", begin, { once: true });

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      v.removeEventListener("loadedmetadata", begin);
    };
  }, [state, videoFailed]);

  const showVideo = !videoFailed && videoReady;

  return (
    <div className={`sim-avatar sim-avatar-${state}`}>
      <div className="sim-avatar-ring" aria-hidden="true" />
      {!videoFailed && (
        <video
          ref={videoRef}
          className={`sim-avatar-video ${state === "speaking" ? "" : "sim-avatar-video-paused"} ${
            showVideo ? "" : "sim-avatar-video-hidden"
          }`}
          src="/loro-interviewer.mp4"
          muted
          playsInline
          loop
          preload="auto"
          onCanPlay={() => setVideoReady(true)}
          onError={failVideo}
          aria-hidden="true"
        />
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

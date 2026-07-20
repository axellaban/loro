import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Loreado.IA — Simulador de Entrevistas",
  description: "Desbloqueá el 'Modo Dios' en tu próxima entrevista. Practicá gratis con una IA que te entrevista de verdad y te da un informe al toque.",
};

// Landing del simulador: misma estética "anti-marketing" que la home (fondo
// negro, mayúsculas, halo de loro), pero el CTA lleva al simulador gratis.
export default function MockLanding() {
  return (
    <div className="landing landing-sim">
      <main className="landing-main">
        <h1 className="landing-title">
          Desbloquea el &apos;Modo Dios&apos; en tu próxima entrevista
        </h1>

        <Image
          src="/modo-dios.gif"
          alt="Modo Dios"
          width={220}
          height={123}
          unoptimized
          className="landing-sticker"
        />

        <h2 className="landing-sub">Practicá con una IA que te entrevista de verdad.</h2>

        <div className="landing-btn-wrap">
          <div className="landing-glow" aria-hidden="true" />
          <Link href="/simulador" className="landing-btn">
            Entrá gratis
          </Link>
        </div>

        <p className="landing-note">
          Sin login, sin instalar nada. El Loro te entrevista por video y te da un informe con tu puntaje.
        </p>
      </main>
    </div>
  );
}

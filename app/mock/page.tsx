import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Loreado.IA — Simulador de Entrevistas",
  description: "Desbloquea el 'Modo Dios' en tu próxima entrevista.",
};

export default function MockLanding() {
  return (
    <div className="landing">
      <main className="landing-main">
        <h1 className="landing-title">
          Desbloquea el &apos;Modo Dios&apos; en tu próxima entrevista
        </h1>

        <Image
          src="/modo-dios.gif"
          alt="Modo Dios"
          width={320}
          height={240}
          unoptimized
          className="landing-sticker"
        />

        <h2 className="landing-sub">Acceso beta cerrado.</h2>

        <div className="landing-btn-wrap">
          <div className="landing-glow" aria-hidden="true" />
          <Link href="/simulador" className="landing-btn">
            Entrá
          </Link>
        </div>

        <p className="landing-warn">
          ⚠️ Estamos experimentando una demanda excepcionalmente alta. Por favor, tené
          paciencia mientras trabajamos en escalar nuestros sistemas.
        </p>
      </main>
    </div>
  );
}

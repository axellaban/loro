import Link from "next/link";
import { ParrotSvg } from "./parrot";

// Banderita "IA": banderín con muesca en V a la derecha y colita de globo de
// diálogo abajo a la izquierda.
//
// La geometría no está estimada a ojo: se midió la silueta de la referencia
// píxel a píxel (79 × 71 px, que es el viewBox de acá) y se ajustó el path
// hasta 0.94 de IoU contra esa máscara. Las diferencias que quedan son de
// ±2 px sobre 79, o sea sub-píxel al tamaño real al que se dibuja.
//
// El cuerpo del banderín va de y=0 a y=56; de ahí para abajo es solo la
// colita. Por eso la altura total (71) es ~1.27x la del bloque visual.
//
// Tipografía: cuerpo de letra tal que la altura de mayúscula sea 25/71 de la
// altura total, y bloque de texto centrado en (32.5, 28.5) — ambas cosas
// medidas contra la referencia, no elegidas.
//
// Color: verde loro (--loro-lime) en vez del naranja de la referencia, para
// que el lockup use el mismo verde que el resaltador del home. Sobre ese lima
// el texto va oscuro: en blanco el contraste queda en ~1.7:1 y es ilegible.
const FLAG_RATIO = 71 / 79;

export function IaFlag({ w = 24 }: { w?: number }) {
  return (
    <svg
      width={w}
      height={w * FLAG_RATIO}
      viewBox="0 0 79 71"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flag-ia"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path
        d="M7 0H75Q79 0 79 4L62 24.5Q58.2 27.5 62 30.5L78.6 51V53Q78.6 56 75 56H24.5Q12.5 63 6 70.4Q2.2 72.6 0 67V7Q0 0 7 0Z"
        fill="#a3e635"
      />
      <text
        x="32.5"
        y="28.5"
        fill="#17181a"
        fontSize="34"
        fontWeight="800"
        fontFamily="system-ui, -apple-system, sans-serif"
        textAnchor="middle"
        dominantBaseline="central"
      >
        IA
      </text>
    </svg>
  );
}

// Logo de marca reutilizable: loro + "Loreado" + banderita IA.
// Es el mismo lockup del home; acá se usa en headers de fondo claro (texto oscuro).
export function BrandLogo({
  parrot = 30,
  fontSize = "1.35rem",
  color = "#17181a",
  // En la referencia el banderín mide 1.37x el alto de las mayúsculas del
  // nombre. Con "Loreado" a 1.35rem (21.6 px) eso da un alto de ~22 px, o sea
  // 24 px de ancho. Solo se pasa el ancho: el alto sale de la proporción.
  flagWidth = 24,
}: {
  parrot?: number;
  fontSize?: string;
  color?: string;
  flagWidth?: number;
}) {
  // El logo es un link al home (comportamiento estándar de logo de marca).
  return (
    <Link href="/" aria-label="Ir al inicio" className="brand-logo" style={{ textDecoration: "none" }}>
      <ParrotSvg size={parrot} />
      <span className="brand-logo-text" style={{ fontSize, color }}>
        Loreado
      </span>
      <IaFlag w={flagWidth} />
    </Link>
  );
}

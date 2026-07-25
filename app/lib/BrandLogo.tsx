import Link from "next/link";
import { ParrotSvg } from "./parrot";

// Banderita "IA": globo de diálogo con la colita abajo a la derecha.
//
// Va en verde loro (--loro-lime) en vez del naranja anterior, para que el
// lockup use el mismo verde que el resaltador del home. Ojo: sobre ese lima el
// texto tiene que ser oscuro — en blanco el contraste queda en ~1.7:1 y a
// tamaño de header es ilegible.
export function IaFlag({ w = 28, h = 23 }: { w?: number; h?: number }) {
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 38 31"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flag-ia"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path
        d="M5 0h24a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5h-6.6l7 6.1c.9.8.3 2.3-.9 2.3H5a5 5 0 0 1-5-5V5a5 5 0 0 1 5-5z"
        fill="#a3e635"
      />
      <text
        x="17"
        y="12.5"
        fill="#17181a"
        fontSize="13"
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
  flag = { w: 27, h: 23 },
}: {
  parrot?: number;
  fontSize?: string;
  color?: string;
  flag?: { w: number; h: number };
}) {
  // El logo es un link al home (comportamiento estándar de logo de marca).
  return (
    <Link href="/" aria-label="Ir al inicio" className="brand-logo" style={{ textDecoration: "none" }}>
      <ParrotSvg size={parrot} />
      <span className="brand-logo-text" style={{ fontSize, color }}>
        Loreado
      </span>
      <IaFlag w={flag.w} h={flag.h} />
    </Link>
  );
}

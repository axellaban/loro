import { ParrotSvg } from "./parrot";

// Banderita tipo Final Round con el texto "IA" (misma que el hub del home).
export function IaFlag({ w = 35, h = 30 }: { w?: number; h?: number }) {
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 35 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path
        d="M6 2h24a4 4 0 0 1 4 4v2a2 2 0 0 1-.4 1.2L29.5 14l4.1 4.8a2 2 0 0 1 .4 1.2v2a4 4 0 0 1-4 4H9.5L4.5 29.5c-.6.5-1.5.1-1.5-.7V26H4a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4h2z"
        fill="#ff4f12"
      />
      <text
        x="16.5"
        y="14"
        fill="#ffffff"
        fontSize="11"
        fontWeight="bold"
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
  return (
    <div className="brand-logo" aria-hidden="true">
      <ParrotSvg size={parrot} />
      <span className="brand-logo-text" style={{ fontSize, color }}>
        Loreado
      </span>
      <IaFlag w={flag.w} h={flag.h} />
    </div>
  );
}

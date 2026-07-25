// Loro de marca como SVG inline en JSX. next/og (Satori) renderiza elementos
// SVG nativos en el árbol (svg/path/circle), a diferencia de emojis o de
// <img> con data-URI SVG que ignora. Autocontenido, sin fetch.
//
// Restricciones de Satori (esto se usa en icon.tsx, apple-icon.tsx y og.tsx):
// solo formas con `fill` planos — nada de gradientes, filtros, clipPath ni
// <text>. Por eso el volumen se sugiere apilando tonos de la misma familia en
// vez de degradados.
//
// Paleta "loro": esmeralda + lima + amarillo + naranja (pico) + cian (cresta).
export function ParrotSvg({ size = 100 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Cola: dos plumas largas que se afinan hacia la punta */}
      <path d="M60 68 C55 85 42 96 21 100 C34 87 47 75 54 63 Z" fill="#22d3ee" />
      <path d="M69 73 C65 88 55 97 38 100 C50 90 59 80 63 69 Z" fill="#a3e635" />

      {/* Cuerpo */}
      <path
        d="M64 34 C84 34 93 55 90 74 C87 91 74 98 61 96 C46 94 38 79 40 61 C42 45 52 34 64 34 Z"
        fill="#10b981"
      />
      {/* Ala plegada: un tono más claro para dar volumen sin degradados */}
      <path
        d="M71 49 C83 53 86 70 79 82 C74 90 65 90 61 82 C56 70 60 50 71 49 Z"
        fill="#34d399"
      />
      {/* Pecho: apenas se asoma por el borde de abajo a la izquierda */}
      <path d="M46 70 C44 82 50 92 60 95 C50 96 42 89 41 78 Z" fill="#6ee7b7" />

      {/* Cabeza */}
      <circle cx="60" cy="33" r="26" fill="#10b981" />

      {/* Cresta: tres plumas en abanico */}
      <path d="M55 14 C50 3 62 0 64 9 Z" fill="#22d3ee" />
      <path d="M64 10 C63 0 74 0 71 12 Z" fill="#fbbf24" />
      <path d="M71 12 C75 2 84 8 78 18 Z" fill="#a3e635" />

      {/* Máscara clara de la cara */}
      <circle cx="54" cy="35" r="16" fill="#ecfdf5" />

      {/* Ojo */}
      <circle cx="56" cy="31" r="7.4" fill="#0a0a0f" />
      <circle cx="58.6" cy="28" r="2.8" fill="#ffffff" />
      <circle cx="53.2" cy="34.6" r="1.3" fill="#ffffff" />

      {/* Pico ganchudo */}
      <path d="M47 24 C32 24 21 33 23 44 C25 52 34 54 40 50 C46 46 49 38 49 30 Z" fill="#f59e0b" />
      <circle cx="40" cy="30" r="2.1" fill="#d97706" />
      <path d="M29 50 C32 57 43 56 45 48 C41 52 34 53 29 50 Z" fill="#d97706" />
    </svg>
  );
}

// Loro de marca como SVG inline en JSX. next/og (Satori) renderiza elementos
// SVG nativos en el árbol (svg/path/circle), a diferencia de emojis o de
// <img> con data-URI SVG que ignora. Autocontenido, sin fetch.
// Paleta "loro": esmeralda + lima + amarillo + naranja (pico) + cian (cresta).
export function ParrotSvg({ size = 100 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M40 74 L18 100 L30 94 L44 84 Z" fill="#a3e635" />
      <path d="M48 78 L30 104 L44 96 L54 86 Z" fill="#22d3ee" />
      <path
        d="M58 40 C84 40 90 66 82 86 C76 100 56 102 46 90 C38 80 38 60 44 50 C48 44 52 40 58 40 Z"
        fill="#10b981"
      />
      <path d="M62 56 C74 56 78 72 72 84 C68 92 58 92 54 84 C50 74 52 58 62 56 Z" fill="#34d399" />
      <circle cx="62" cy="36" r="24" fill="#10b981" />
      <path d="M60 12 C58 4 66 3 66 11 C70 3 76 7 72 15 Z" fill="#22d3ee" />
      <path d="M68 12 C68 4 76 6 73 14 Z" fill="#fbbf24" />
      <circle cx="58" cy="38" r="14" fill="#ecfdf5" />
      <circle cx="59" cy="34" r="6.5" fill="#0a0a0f" />
      <circle cx="61" cy="32" r="2.2" fill="#ffffff" />
      <path d="M44 34 C31 32 29 44 41 47 C48 48 51 46 53 41 C53 36 50 34 44 34 Z" fill="#f59e0b" />
      <path d="M41 47 C39 52 47 54 49 47 Z" fill="#d97706" />
    </svg>
  );
}

// El ave, dibujada. Un solo SVG para las cuatro especies: cambia el color, no
// la forma. La silueta es de vuelo —alas abiertas, arriba y abajo— porque es
// la que se lee a 24 píxeles arriba del mapa, que es donde más se usa.
//
// Mira a la DERECHA. Quien la rota según el rumbo resta 90°.

import { AVES, type AveId } from "../lib/aves";

export function Ave({
  especie,
  size = 40,
  aletea = false,
}: {
  especie: AveId;
  size?: number;
  aletea?: boolean;
}) {
  const color = AVES[especie].color;

  return (
    <svg
      width={size}
      height={size * 0.83}
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={aletea ? { animation: "aletear 0.55s ease-in-out infinite" } : undefined}
      aria-hidden="true"
    >
      {/* Cola: dos plumas largas, la de atrás más oscura para dar profundidad */}
      <path d="M2 46 L34 39 L34 55 Z" fill={color} opacity="0.55" />
      <path d="M6 52 L34 44 L34 62 Z" fill={color} opacity="0.8" />

      {/* Ala de abajo: barrida hacia atrás */}
      <path
        d="M54 55 C50 70 57 85 73 93 C65 79 63 66 64 56 Z"
        fill={color}
        opacity="0.62"
      />

      {/* Cuerpo */}
      <path
        d="M28 51 C31 42 45 38 63 40 C78 41 86 45 89 50 C86 56 76 60 60 60 C43 60 30 58 28 51 Z"
        fill={color}
      />

      {/* Ala de arriba: la que domina la silueta */}
      <path
        d="M52 47 C45 27 55 8 77 4 C69 21 67 35 66 48 Z"
        fill={color}
      />
      <path
        d="M56 45 C52 31 58 18 70 12 C64 24 61 34 61 45 Z"
        fill="#ffffff"
        opacity="0.22"
      />

      {/* Cresta: dos plumitas. Es lo que lo vuelve loro y no gaviota. */}
      <path d="M84 34 C82 25 90 23 90 32 Z" fill={color} />
      <path d="M90 32 C90 23 98 25 95 35 Z" fill={color} opacity="0.7" />

      {/* Cabeza */}
      <circle cx="88" cy="45" r="11.5" fill={color} />
      <circle cx="88" cy="45" r="11.5" fill="#ffffff" opacity="0.14" />

      {/* Pico ganchudo */}
      <path d="M97 38 C110 37 115 45 108 52 C103 57 97 54 96 48 Z" fill="#f59e0b" />
      <path d="M99 52 C103 57 111 55 111 49 C108 53 103 54 99 52 Z" fill="#d97706" />

      {/* Ojo */}
      <circle cx="92" cy="42" r="3.1" fill="#08110f" />
      <circle cx="93" cy="41" r="1.1" fill="#ffffff" />
    </svg>
  );
}

/** El ave en HTML plano, para el marcador de Leaflet (que no acepta JSX). */
export function aveHtml(especie: AveId, size = 34): string {
  const color = AVES[especie].color;
  return `<svg width="${size}" height="${size * 0.83}" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M2 46 L34 39 L34 55 Z" fill="${color}" opacity="0.55"/>
<path d="M6 52 L34 44 L34 62 Z" fill="${color}" opacity="0.8"/>
<path d="M54 55 C50 70 57 85 73 93 C65 79 63 66 64 56 Z" fill="${color}" opacity="0.62"/>
<path d="M28 51 C31 42 45 38 63 40 C78 41 86 45 89 50 C86 56 76 60 60 60 C43 60 30 58 28 51 Z" fill="${color}"/>
<path d="M52 47 C45 27 55 8 77 4 C69 21 67 35 66 48 Z" fill="${color}"/>
<path d="M56 45 C52 31 58 18 70 12 C64 24 61 34 61 45 Z" fill="#ffffff" opacity="0.22"/>
<path d="M84 34 C82 25 90 23 90 32 Z" fill="${color}"/>
<path d="M90 32 C90 23 98 25 95 35 Z" fill="${color}" opacity="0.7"/>
<circle cx="88" cy="45" r="11.5" fill="${color}"/>
<circle cx="88" cy="45" r="11.5" fill="#ffffff" opacity="0.14"/>
<path d="M97 38 C110 37 115 45 108 52 C103 57 97 54 96 48 Z" fill="#f59e0b"/>
<path d="M99 52 C103 57 111 55 111 49 C108 53 103 54 99 52 Z" fill="#d97706"/>
<circle cx="92" cy="42" r="3.1" fill="#08110f"/>
<circle cx="93" cy="41" r="1.1" fill="#ffffff"/>
</svg>`;
}

import { ImageResponse } from "next/og";

// Tamaño estándar de Open Graph / Twitter card.
export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

// Card compartible (WhatsApp/Twitter/etc.). Estética de la landing: negro puro,
// acento esmeralda, tipografía grande y provocadora. Sin dependencias externas
// (fuente del sistema) para que buildee y renderice en el edge sin fetch.
export function ogImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#000",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 40 }}>🦜</div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 800,
              color: "#10b981",
              letterSpacing: 1,
            }}
          >
            Loreado.IA
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.1,
            letterSpacing: -1,
          }}
        >
          El copiloto de IA que RRHH no quiere que uses.
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              background: "#10b981",
              color: "#000",
              fontSize: 30,
              fontWeight: 800,
              padding: "12px 28px",
              borderRadius: 999,
            }}
          >
            Entrevistas en tiempo real
          </div>
          <div style={{ display: "flex", color: "#9aa0a6", fontSize: 30, fontWeight: 600 }}>
            Gratis · sin instalar nada
          </div>
        </div>
      </div>
    ),
    { ...ogSize }
  );
}

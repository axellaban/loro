import { ImageResponse } from "next/og";
import { ParrotSvg } from "./lib/parrot";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Ícono para "Agregar a inicio" en iOS.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0f",
        }}
      >
        <ParrotSvg size={130} />
      </div>
    ),
    { ...size }
  );
}

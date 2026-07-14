import { ImageResponse } from "next/og";
import { ParrotSvg } from "./lib/parrot";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Favicon: loro de marca sobre fondo oscuro.
export default function Icon() {
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
          borderRadius: 7,
        }}
      >
        <ParrotSvg size={26} />
      </div>
    ),
    { ...size }
  );
}

import { ImageResponse } from "next/og";
import { ParrotSvg } from "./parrot";
import { LORO_PHOTO, LORO_PHOTO_V } from "./ogLoro";
import { INTER_800_B64, INTER_900_B64 } from "./ogFonts";

// Tamaño estándar de Open Graph / Twitter card.
export const ogSize = { width: 1200, height: 630 };
// Vertical (4:5) para el preview de WhatsApp/IG, que muestran imágenes verticales.
export const ogSizeVertical = { width: 1080, height: 1350 };
export const ogContentType = "image/png";

// Paleta "loro" (la del glow del botón Responder): verde → lima → amarillo →
// naranja → rosa → cian. Se reusa en el marco, el título y la pill.
const LORO_GRADIENT =
  "linear-gradient(90deg,#10b981,#34d399,#a3e635,#fbbf24,#f59e0b,#fb7185,#22d3ee,#10b981)";
const LORO_TEXT_GRADIENT =
  "linear-gradient(90deg,#34d399,#a3e635,#fbbf24,#f59e0b,#fb7185,#22d3ee)";

// Inter (la fuente de la marca) subseteada, en peso ExtraBold (800) y Black (900),
// para que el texto de la card se vea bien grueso. Embebida en base64 (sin fetch,
// así funciona en el prerender del build).
function loadInterFonts() {
  return [
    { name: "Inter", data: Buffer.from(INTER_800_B64, "base64"), weight: 800 as const, style: "normal" as const },
    { name: "Inter", data: Buffer.from(INTER_900_B64, "base64"), weight: 900 as const, style: "normal" as const },
  ];
}

// Card VERTICAL de compartir (WhatsApp/IG muestran verticales enteras): foto del
// loro a pantalla completa con la frase abajo sobre un degradado oscuro.
export async function ogHomeImageVertical() {
  const fonts = loadInterFonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: LORO_GRADIENT,
          padding: 16,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            background: "#0a0a0f",
            borderRadius: 28,
            overflow: "hidden",
            fontFamily: "Inter",
          }}
        >
          {/* Foto del loro a pantalla completa */}
          <img
            src={LORO_PHOTO_V}
            width={1048}
            height={1318}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* Scrim: oscurece arriba (para el logo) y abajo (para la frase). */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              background:
                "linear-gradient(180deg, rgba(10,10,15,0.72) 0%, rgba(10,10,15,0) 20%, rgba(10,10,15,0) 38%, rgba(10,10,15,0.9) 62%, #0a0a0f 100%)",
            }}
          />

          {/* Contenido: logo arriba, frase + pill abajo */}
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: "100%",
              height: "100%",
              padding: "48px 56px 56px 56px",
            }}
          >
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <ParrotSvg size={54} />
              <div style={{ display: "flex", fontSize: 42, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>
                Loreado
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#ff4f12",
                  color: "#fff",
                  fontSize: 24,
                  fontWeight: 800,
                  padding: "4px 12px",
                  borderRadius: 9,
                  marginLeft: 2,
                }}
              >
                IA
              </div>
            </div>

            {/* Frase + pill */}
            <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
              <div style={{ display: "flex", flexDirection: "column", letterSpacing: -1 }}>
                <div style={{ display: "flex", fontSize: 84, fontWeight: 900, lineHeight: 1.02, color: "#fff" }}>
                  METELE EL LORO
                </div>
                <div style={{ display: "flex", fontSize: 84, fontWeight: 900, lineHeight: 1.02, color: "#fff" }}>
                  A TU
                </div>
                <div style={{ display: "flex", fontSize: 84, fontWeight: 900, lineHeight: 1.02, color: "#a3e635" }}>
                  PRÓXIMA
                </div>
                <div style={{ display: "flex", fontSize: 84, fontWeight: 900, lineHeight: 1.02, color: "#a3e635" }}>
                  ENTREVISTA
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div
                  style={{
                    display: "flex",
                    background: LORO_GRADIENT,
                    color: "#06231a",
                    fontSize: 30,
                    fontWeight: 800,
                    padding: "12px 28px",
                    borderRadius: 999,
                  }}
                >
                  Simulador + Copiloto
                </div>
                <div style={{ display: "flex", color: "#e6e9ec", fontSize: 30, fontWeight: 600 }}>
                  Gratis · sin login
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...ogSizeVertical, fonts }
  );
}

// Card de compartir del HOME: foto real del loro (frame del video) a la derecha
// y la frase a la izquierda sobre fondo oscuro. Horizontal 1200x630 (estándar de
// preview de links) para que WhatsApp/Twitter/etc. la muestren completa.
export async function ogHomeImage() {
  const fonts = loadInterFonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: LORO_GRADIENT,
          padding: 14,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            background: "#0a0a0f",
            borderRadius: 24,
            overflow: "hidden",
            fontFamily: "Inter",
          }}
        >
          {/* Foto del loro (frame del video) a la derecha */}
          <img
            src={LORO_PHOTO}
            width={560}
            height={602}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: 560,
              height: "100%",
              objectFit: "cover",
            }}
          />
          {/* Scrim oscuro que difumina la foto hacia el texto (izq→der). */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              background:
                "linear-gradient(90deg, #0a0a0f 44%, rgba(10,10,15,0.86) 56%, rgba(10,10,15,0) 74%)",
            }}
          />
          {/* Glows sutiles de marca. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              background:
                "radial-gradient(circle at 6% 14%, rgba(163,230,53,0.22), transparent 40%)," +
                "radial-gradient(circle at 4% 94%, rgba(34,211,238,0.16), transparent 45%)",
            }}
          />

          {/* Columna de texto a la izquierda */}
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "52px 56px",
              width: 720,
              height: "100%",
            }}
          >
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <ParrotSvg size={50} />
              <div style={{ display: "flex", fontSize: 38, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>
                Loreado
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#ff4f12",
                  color: "#fff",
                  fontSize: 22,
                  fontWeight: 800,
                  padding: "3px 11px",
                  borderRadius: 8,
                  marginLeft: 2,
                }}
              >
                IA
              </div>
            </div>

            {/* Frase */}
            <div style={{ display: "flex", flexDirection: "column", letterSpacing: -1 }}>
              <div style={{ display: "flex", fontSize: 62, fontWeight: 900, lineHeight: 1.04, color: "#fff" }}>
                METELE EL LORO
              </div>
              <div style={{ display: "flex", fontSize: 62, fontWeight: 900, lineHeight: 1.04, color: "#fff" }}>
                A TU
              </div>
              <div style={{ display: "flex", fontSize: 62, fontWeight: 900, lineHeight: 1.04, color: "#a3e635" }}>
                PRÓXIMA ENTREVISTA
              </div>
            </div>

            {/* Pie: pill + claim */}
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  display: "flex",
                  background: LORO_GRADIENT,
                  color: "#06231a",
                  fontSize: 27,
                  fontWeight: 800,
                  padding: "11px 26px",
                  borderRadius: 999,
                }}
              >
                Simulador + Copiloto
              </div>
              <div style={{ display: "flex", color: "#c7ccd1", fontSize: 27, fontWeight: 600 }}>
                Gratis · sin login
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...ogSize, fonts }
  );
}

// Card compartible (WhatsApp/Twitter/etc.), psicodélica: marco de degradado,
// glows de color de fondo y tipografía con los colores del loro. Sin fetch
// externo (fuente del sistema) para renderizar en el edge.
// Parametrizable por página; los defaults son la card del copiloto (home).
export function ogImage(opts?: { title?: string; pill?: string; claim?: string }) {
  const title = opts?.title ?? "El copiloto de IA que RRHH no quiere que uses.";
  const pill = opts?.pill ?? "Entrevistas en tiempo real";
  const claim = opts?.claim ?? "Gratis · sin instalar nada";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          // El div externo es el MARCO de degradado (padding = grosor del marco).
          background: LORO_GRADIENT,
          padding: 16,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: "#0a0a0f",
            borderRadius: 28,
            padding: "64px 72px",
            overflow: "hidden",
            fontFamily: "sans-serif",
          }}
        >
          {/* Capa de glows psicodélicos de fondo (radiales de color). */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              background:
                "radial-gradient(circle at 12% 18%, rgba(16,185,129,0.45), transparent 42%)," +
                "radial-gradient(circle at 88% 12%, rgba(34,211,238,0.40), transparent 40%)," +
                "radial-gradient(circle at 80% 92%, rgba(251,113,133,0.42), transparent 42%)," +
                "radial-gradient(circle at 22% 95%, rgba(251,191,36,0.35), transparent 45%)," +
                "radial-gradient(circle at 55% 50%, rgba(163,230,53,0.18), transparent 55%)",
            }}
          />

          {/* Marca */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, zIndex: 1 }}>
            <ParrotSvg size={58} />
            <div
              style={{
                display: "flex",
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: 1,
                backgroundImage: LORO_TEXT_GRADIENT,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              Loreado.IA
            </div>
          </div>

          {/* Título con degradado */}
          <div
            style={{
              display: "flex",
              fontSize: 78,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: -1,
              backgroundImage: LORO_TEXT_GRADIENT,
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              zIndex: 1,
            }}
          >
            {title}
          </div>

          {/* Pie: pill de degradado + claim */}
          <div style={{ display: "flex", alignItems: "center", gap: 22, zIndex: 1 }}>
            <div
              style={{
                display: "flex",
                background: LORO_GRADIENT,
                color: "#06231a",
                fontSize: 30,
                fontWeight: 800,
                padding: "13px 30px",
                borderRadius: 999,
              }}
            >
              {pill}
            </div>
            <div style={{ display: "flex", color: "#c7ccd1", fontSize: 30, fontWeight: 600 }}>
              {claim}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...ogSize }
  );
}

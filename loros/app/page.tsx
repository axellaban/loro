// La portada. Explica la idea antes de pedir nada: recién en /nido se pide el
// nombre y la ubicación.
//
// Los tiempos de la tabla no están escritos a mano: salen de la misma fórmula
// que usa el servidor cuando suelta un ave de verdad. Si mañana se cambia la
// velocidad de una especie, esta página se corrige sola.

import Link from "next/link";
import { AVES_LISTA } from "../lib/aves";
import { distanciaKm, formatearDistancia, formatearDuracion } from "../lib/geo";
import { duracionVuelo } from "../lib/vuelo";
import { Ave } from "../components/Ave";

const RUTAS = [
  {
    nombre: "Cruzar la ciudad",
    detalle: "Palermo → La Boca",
    a: { lat: -34.5783, lng: -58.4245 },
    b: { lat: -34.6345, lng: -58.3631 },
  },
  {
    nombre: "Cruzar el río",
    detalle: "Buenos Aires → Montevideo",
    a: { lat: -34.6037, lng: -58.3816 },
    b: { lat: -34.9011, lng: -56.1645 },
  },
  {
    nombre: "Cruzar el charco",
    detalle: "Buenos Aires → Madrid",
    a: { lat: -34.6037, lng: -58.3816 },
    b: { lat: 40.4168, lng: -3.7038 },
  },
];

export default function Portada() {
  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px 80px" }}>
      {/* ---------- hero ---------- */}
      <section style={{ padding: "72px 0 56px", textAlign: "center" }}>
        <p className="pastilla" style={{ marginBottom: 26 }}>
          🦜 Mensajería con distancia real
        </p>

        <h1
          style={{
            fontSize: "clamp(38px, 8.2vw, 74px)",
            fontWeight: 850,
            lineHeight: 0.98,
            letterSpacing: "-0.035em",
          }}
        >
          Envía Loros,
          <br />
          <span
            style={{
              background: "linear-gradient(100deg, #a3e635, #10b981 45%, #22d3ee)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            no mensajes.
          </span>
        </h1>

        <p
          style={{
            maxWidth: 620,
            margin: "24px auto 0",
            fontSize: "clamp(16px, 2.4vw, 19px)",
            lineHeight: 1.6,
            color: "var(--suave)",
          }}
        >
          Tu loro despega desde donde estás y vuela hasta el otro nido a su
          propia velocidad. Hasta que no aterriza, el mensaje no existe del otro
          lado. La distancia entre ustedes vuelve a significar algo.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: 34,
          }}
        >
          <Link href="/nido" className="boton" style={{ padding: "15px 28px", fontSize: 16 }}>
            Soltar mi primer loro
          </Link>
          <a href="#aves" className="boton fantasma" style={{ padding: "15px 24px" }}>
            Ver las cuatro aves
          </a>
        </div>

        <Trayectoria />
      </section>

      {/* ---------- cómo funciona ---------- */}
      <section style={{ padding: "16px 0 64px" }}>
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(212px, 1fr))",
          }}
        >
          {[
            {
              n: "01",
              t: "Elegí el ave",
              d: "Perico, cotorra, loro o guacamayo. Cada una vuela a su velocidad y aguanta un largo de mensaje distinto.",
            },
            {
              n: "02",
              t: "Soltala",
              d: "Sale desde tu ubicación real. Antes de mandar ya sabés cuánto va a tardar hasta esa persona, al minuto.",
            },
            {
              n: "03",
              t: "Seguí el vuelo",
              d: "La ves cruzar el mapa en vivo, con lo que falta y lo que ya recorrió. Los dos miran la misma ave.",
            },
            {
              n: "04",
              t: "Aterriza",
              d: "Recién ahí se abre el mensaje. Ni un segundo antes: el texto no sale del servidor hasta que el ave llega.",
            },
          ].map((x) => (
            <div key={x.n} className="tarjeta" style={{ padding: 20 }}>
              <p
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  color: "var(--esmeralda)",
                  marginBottom: 10,
                }}
              >
                {x.n}
              </p>
              <h3 style={{ fontSize: 17.5, marginBottom: 8 }}>{x.t}</h3>
              <p style={{ color: "var(--suave)", fontSize: 14.5, lineHeight: 1.6 }}>{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- las aves ---------- */}
      <section id="aves" style={{ padding: "16px 0 56px", scrollMarginTop: 24 }}>
        <h2 style={{ fontSize: "clamp(27px, 4.5vw, 38px)", fontWeight: 800, marginBottom: 10 }}>
          Cuatro aves, cuatro maneras de decir algo
        </h2>
        <p style={{ color: "var(--suave)", fontSize: 16, marginBottom: 28, maxWidth: 620 }}>
          Cuanto más rápido vuela, menos le entra en la cabeza. Elegir el ave es
          parte del mensaje: mandar un guacamayo es decir <em>esto puede esperar,
          y quiero que lo esperes</em>.
        </p>

        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          }}
        >
          {AVES_LISTA.map((a) => (
            <div
              key={a.id}
              className="tarjeta"
              style={{ padding: 20, borderColor: `${a.color}3a` }}
            >
              <Ave especie={a.id} size={54} />
              <h3 style={{ fontSize: 20, margin: "12px 0 2px" }}>{a.nombre}</h3>
              <p style={{ color: a.color, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                {a.lema}
              </p>
              <p
                style={{
                  color: "var(--suave)",
                  fontSize: 14,
                  lineHeight: 1.6,
                  marginBottom: 16,
                  minHeight: 88,
                }}
              >
                {a.descripcion}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="pastilla" style={{ color: a.color }}>
                  {a.velocidadKmh} km/h
                </span>
                <span className="pastilla">{a.maxCaracteres} caracteres</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- tabla de tiempos ---------- */}
      <section style={{ padding: "16px 0 56px" }}>
        <h2 style={{ fontSize: "clamp(24px, 4vw, 33px)", fontWeight: 800, marginBottom: 8 }}>
          Cuánto tarda, de verdad
        </h2>
        <p style={{ color: "var(--suave)", fontSize: 15.5, marginBottom: 24 }}>
          Distancias reales, calculadas con la misma fórmula que usa la app.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          {RUTAS.map((r) => {
            const km = distanciaKm(r.a, r.b);
            return (
              <div key={r.nombre} className="tarjeta" style={{ padding: "16px 18px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 10,
                    flexWrap: "wrap",
                    marginBottom: 14,
                  }}
                >
                  <h3 style={{ fontSize: 17 }}>{r.nombre}</h3>
                  <span style={{ color: "var(--tenue)", fontSize: 13.5 }}>{r.detalle}</span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontFamily: "var(--mono)",
                      fontSize: 13.5,
                      color: "var(--esmeralda-alto)",
                    }}
                  >
                    {formatearDistancia(km)}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))",
                  }}
                >
                  {AVES_LISTA.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: `${a.color}12`,
                        border: `1px solid ${a.color}30`,
                      }}
                    >
                      <p style={{ fontSize: 11.5, color: "var(--suave)", marginBottom: 3 }}>
                        {a.nombre}
                      </p>
                      <p style={{ fontSize: 16, fontWeight: 750, color: a.color }}>
                        {formatearDuracion(duracionVuelo(km, a.id, false))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p style={{ color: "var(--tenue)", fontSize: 13, marginTop: 14, lineHeight: 1.6 }}>
          ¿Diez mil kilómetros y días de vuelo? Sí. Esa es la idea. Para
          mostrarle la app a alguien sin esperar, cada envío tiene un{" "}
          <strong style={{ color: "var(--suave)" }}>vuelo de prueba</strong>: comprime
          el viaje a unos minutos manteniendo las proporciones entre aves, así se
          ve la diferencia sin esperar dos semanas.
        </p>
      </section>

      {/* ---------- cierre ---------- */}
      <section
        className="tarjeta"
        style={{ padding: "44px 28px", textAlign: "center", marginBottom: 44 }}
      >
        <h2 style={{ fontSize: "clamp(24px, 4vw, 34px)", fontWeight: 800, marginBottom: 14 }}>
          Nadie extraña las cartas por el papel
        </h2>
        <p
          style={{
            color: "var(--suave)",
            fontSize: 16.5,
            lineHeight: 1.65,
            maxWidth: 560,
            margin: "0 auto 28px",
          }}
        >
          Las extrañan por la espera. Por saber que algo estaba en camino. Eso es
          lo único que hace esta app: devolverle al mensaje el tiempo que tarda
          en llegar.
        </p>
        <Link href="/nido" className="boton" style={{ padding: "15px 30px", fontSize: 16 }}>
          Armar mi nido
        </Link>
      </section>

      <footer
        style={{
          borderTop: "1px solid var(--borde)",
          paddingTop: 22,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          color: "var(--tenue)",
          fontSize: 13,
        }}
      >
        <Ave especie="loro" size={22} />
        <span>Loros — MVP</span>
        <span style={{ marginLeft: "auto" }}>
          Mapas de OpenStreetMap · sin publicidad · sin rastreo
        </span>
      </footer>
    </main>
  );
}

/** El arco del hero: la ruta punteada con el ave a media distancia. */
function Trayectoria() {
  return (
    <div style={{ position: "relative", maxWidth: 640, margin: "48px auto 0", height: 120 }}>
      <svg viewBox="0 0 640 120" style={{ width: "100%", height: "100%" }} aria-hidden="true">
        <path
          d="M40 96 Q320 -18 600 96"
          fill="none"
          stroke="#10b981"
          strokeOpacity="0.4"
          strokeWidth="2"
          strokeDasharray="3 10"
          strokeLinecap="round"
        />
        <circle cx="40" cy="96" r="6" fill="#10b981" />
        <circle cx="600" cy="96" r="6" fill="#22d3ee" />
        <text x="40" y="118" fill="#5d7873" fontSize="12" textAnchor="middle">
          tu nido
        </text>
        <text x="600" y="118" fill="#5d7873" fontSize="12" textAnchor="middle">
          el suyo
        </text>
      </svg>
      <div
        style={{
          position: "absolute",
          left: "48%",
          top: 8,
          transform: "translateX(-50%)",
          animation: "aletear 0.7s ease-in-out infinite",
        }}
      >
        <Ave especie="loro" size={52} />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Condiciones del Servicio — Loreado.IA",
  description:
    "Las reglas de uso de Loreado.IA: qué ofrecemos, qué no garantizamos y de qué sos responsable vos.",
  alternates: { canonical: "/terms" },
};

/**
 * La ruta es /terms y no /condiciones porque es la que quedó cargada en la
 * consola de Google, y cambiarla ahí obliga a re-verificar el dominio. No vale
 * la pena por una palabra en la URL.
 */
export default function Terms() {
  return (
    <main className="legal">
      <p className="legal-volver">
        <Link href="/">← Volver a Loreado.IA</Link>
      </p>

      <h1>Condiciones del Servicio</h1>
      <p className="legal-fecha">Última actualización: 4 de agosto de 2026</p>

      <p className="legal-intro">
        Al usar Loreado.IA aceptás lo que sigue. Está escrito para que se
        entienda de una lectura.
      </p>

      <h2>Qué es Loreado.IA</h2>
      <p>
        Una herramienta que escucha una entrevista de trabajo y te sugiere
        respuestas con inteligencia artificial, más un simulador para practicar
        entrevistas por tu cuenta. Está en desarrollo activo: puede cambiar,
        fallar o dejar de estar disponible sin aviso.
      </p>

      <h2>Tu responsabilidad al usarla</h2>
      <p>
        Esto es lo más importante de toda esta página, así que va sin
        eufemismos: <strong>usar una ayuda de IA durante una entrevista puede
        estar prohibido</strong> por la empresa que te entrevista, por la
        plataforma de videollamada o por las reglas del proceso de selección al
        que te presentaste.
      </p>
      <p>
        Averiguar si está permitido en tu caso, y decidir si lo hacés, es
        exclusivamente tuyo. Nosotros te damos una herramienta; el uso que le
        des y sus consecuencias corren por tu cuenta. Tampoco te garantizamos
        que su uso pase inadvertido.
      </p>
      <p>
        También te comprometés a no usarla para suplantar a otra persona, ni
        para grabar a alguien donde la ley exija su consentimiento y no lo
        tengas.
      </p>

      <h2>Qué no garantizamos</h2>
      <ul>
        <li>
          <strong>Que las respuestas sean correctas.</strong> Las genera un
          modelo de IA y puede equivocarse, inventar datos o decir algo que no
          te conviene. Leelas antes de usarlas: la última palabra es tuya.
        </li>
        <li>
          <strong>Que el servicio esté siempre disponible.</strong> Depende de
          proveedores externos que pueden fallar o cortar el servicio.
        </li>
        <li>
          <strong>Que consigas el trabajo.</strong> Obvio, pero queda dicho.
        </li>
      </ul>
      <p>
        El servicio se ofrece &ldquo;tal como está&rdquo;. En la medida en que
        la ley lo permita, no nos hacemos responsables de daños derivados de su
        uso, incluyendo la pérdida de una oportunidad laboral.
      </p>

      <h2>Pases y pagos</h2>
      <p>
        Los pases se compran con tarjeta, por MercadoPago o por Binance, y
        habilitan uso ilimitado durante el plazo contratado (7 días o 12 meses).
        Cada pase vale <strong>para una sola persona y una sola cuenta</strong>:
        al activarlo estando dentro de tu cuenta de Google, queda atado a ella.
        Compartirlo no funciona.
      </p>
      {/* La renovación automática hay que decirla antes de cobrarla, no
          después. Es lo que exigen las reglas de las tarjetas y, más concreto,
          es la diferencia entre una baja y un contracargo. */}
      <p>
        Los pases comprados <strong>con tarjeta se renuevan solos</strong> al
        final de cada período (cada 7 días o cada 12 meses, según el que hayas
        elegido) hasta que los des de baja. Podés darlos de baja cuando quieras
        desde <em>Administrar suscripción</em> dentro de la app, que abre el
        portal de facturación de Stripe — ahí mismo cambiás la tarjeta y bajás
        tus facturas. Al dar de baja conservás el acceso hasta el final del
        período que ya pagaste. Los pases de MercadoPago y Binance no se
        renuevan solos.
      </p>
      <p>
        Los pagos con tarjeta los procesa Stripe: los datos de tu tarjeta nunca
        pasan por nuestros servidores.
      </p>
      <p>
        Si el servicio no funciona como corresponde y no lo podemos resolver,
        escribinos y te devolvemos el dinero. Si perdiste el acceso a tu cuenta,
        escribinos y liberamos tu pase para que lo puedas reactivar.
      </p>

      <h2>Uso aceptable</h2>
      <p>
        No uses Loreado.IA para actividades ilegales, para acosar a nadie, ni
        para intentar romper, sobrecargar o vulnerar el servicio. Podemos
        suspender el acceso de quien lo haga.
      </p>

      <h2>Contenido</h2>
      <p>
        Lo que cargás es tuyo y sigue siendo tuyo. Las respuestas que genera la
        IA podés usarlas libremente. El código, el diseño y la marca de
        Loreado.IA son nuestros.
      </p>

      <h2>Cambios y cierre</h2>
      <p>
        Podemos modificar estas condiciones; la fecha de arriba indica la última
        versión. Si algún cambio es importante, avisamos dentro de la app. Podés
        dejar de usar el servicio cuando quieras.
      </p>

      <h2>Contacto</h2>
      <p>
        Cualquier duda o reclamo:{" "}
        <a href="mailto:axellaban@gmail.com">axellaban@gmail.com</a>
      </p>

      <p className="legal-volver legal-volver-fin">
        <Link href="/">← Volver a Loreado.IA</Link>
      </p>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidad — Loreado.IA",
  description:
    "Qué datos maneja Loreado.IA, a dónde van y qué se guarda. En castellano y sin vueltas.",
  alternates: { canonical: "/privacidad" },
};

/**
 * Google exige un link público de privacidad para las apps que usan OAuth, y
 * lo muestra en la pantalla de consentimiento. Pero el motivo de fondo es otro:
 * esta app escucha entrevistas de trabajo. Quien la usa merece saber, sin tener
 * que confiar, qué se manda a dónde y qué queda guardado.
 */
export default function Privacidad() {
  return (
    <main className="legal">
      <p className="legal-volver">
        <Link href="/">← Volver a Loreado.IA</Link>
      </p>

      <h1>Política de Privacidad</h1>
      <p className="legal-fecha">Última actualización: 4 de agosto de 2026</p>

      <p className="legal-intro">
        Loreado.IA escucha entrevistas de trabajo para sugerirte respuestas. Es
        información sensible y lo sabemos, así que acá está exactamente qué pasa
        con cada dato, sin párrafos de relleno.
      </p>

      <h2>Lo más importante, primero</h2>
      <ul>
        <li>
          <strong>No guardamos el audio de tus entrevistas.</strong> Ni el
          nuestro ni el de nadie. Se transcribe al vuelo y se descarta.
        </li>
        <li>
          <strong>Tus sesiones guardadas quedan en tu navegador.</strong> No
          viajan a ningún servidor nuestro. Si borrás los datos del navegador,
          se borran y no tenemos copia.
        </li>
        <li>
          <strong>No vendemos datos a nadie</strong>, ni los usamos para
          publicidad.
        </li>
      </ul>

      <h2>El audio y la transcripción</h2>
      <p>
        Cuando arrancás una sesión, el audio de la pestaña que compartís (y el
        de tu micrófono, si lo activás) se envía a{" "}
        <a href="https://deepgram.com/privacy" target="_blank" rel="noreferrer">
          Deepgram
        </a>
        , que lo convierte en texto en tiempo real. Ese audio no pasa por
        nuestros servidores ni queda almacenado en ningún lado.
      </p>
      <p>
        La transcripción resultante, junto con el contexto que hayas cargado
        (empresa, puesto, tu perfil), se manda al modelo de IA que elegiste para
        generar la respuesta. Según cuál uses, ese proveedor es{" "}
        <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noreferrer">
          OpenAI
        </a>
        ,{" "}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
          Google
        </a>{" "}
        o{" "}
        <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noreferrer">
          Anthropic
        </a>
        . Cada uno tiene su propia política, enlazada arriba.
      </p>

      <h2>Lo que se guarda en tu navegador</h2>
      <p>
        Estas cosas viven en el <em>localStorage</em> de tu dispositivo y nunca
        se envían a nosotros:
      </p>
      <ul>
        <li>Las sesiones que elegís guardar, con sus transcripciones y respuestas.</li>
        <li>Tus preferencias: idioma, modelo, tamaño de texto, comportamiento.</li>
        <li>El código de tu pase, si tenés uno.</li>
        <li>Tu email, si lo dejaste para desbloquear un informe.</li>
      </ul>
      <p>
        Podés borrar todo esto desde la propia app o limpiando los datos del
        sitio en tu navegador.
      </p>

      <h2>Si entrás con Google</h2>
      <p>
        Entrar con Google es opcional: la app funciona igual sin hacerlo. Si
        entrás, recibimos de Google tu <strong>email, nombre, foto de perfil e
        identificador de cuenta</strong>. Nada más — no pedimos acceso a tu
        Gmail, ni a tus contactos, ni a tu Drive, ni a nada tuyo.
      </p>
      <p>
        Guardamos una única cosa asociada a tu cuenta: <strong>qué pase te
        corresponde</strong>. Sirve para que, si pagaste, tu pase te siga cuando
        abrís la app en otro dispositivo. Ese dato vive en una base de{" "}
        <a href="https://upstash.com/trust/privacy.pdf" target="_blank" rel="noreferrer">
          Upstash
        </a>{" "}
        y se borra solo cuando el pase vence.
      </p>
      <p>
        Tu sesión se mantiene con una cookie firmada que solo el servidor puede
        leer. No usamos cookies de publicidad ni de rastreo de terceros.
      </p>

      <h2>Tu email</h2>
      <p>
        Si dejás tu email —para la lista de espera o para desbloquear un
        informe— se guarda en un formulario de Google Forms al que solo accedemos
        nosotros. Lo usamos para avisarte novedades y para responderte. No lo
        compartimos con terceros.
      </p>

      <h2>Métricas de uso</h2>
      <p>
        Usamos{" "}
        <a href="https://posthog.com/privacy" target="_blank" rel="noreferrer">
          PostHog
        </a>{" "}
        y{" "}
        <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">
          Vercel Analytics
        </a>{" "}
        para saber qué partes de la app se usan y cuáles no. Se registran
        eventos como &ldquo;arrancó una sesión&rdquo; o &ldquo;pidió una
        respuesta&rdquo;, nunca el contenido de tus entrevistas.
      </p>

      <h2>Pagos</h2>
      <p>
        Los pagos se hacen en MercadoPago o Binance. Nunca vemos ni guardamos
        los datos de tu tarjeta ni de tu billetera: esa información va directo
        al procesador de pago y no pasa por nosotros.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Podés pedirnos que te digamos qué datos tuyos tenemos, que los
        corrijamos o que los borremos. Escribinos a{" "}
        <a href="mailto:axellaban@gmail.com">axellaban@gmail.com</a> y lo
        resolvemos. Como casi todo vive en tu propio navegador, la mayoría de
        las veces lo podés hacer vos mismo en un click.
      </p>

      <h2>Cambios</h2>
      <p>
        Si esto cambia, actualizamos la fecha de arriba. Si el cambio es
        importante, te avisamos dentro de la app.
      </p>

      <h2>Contacto</h2>
      <p>
        Cualquier duda: <a href="mailto:axellaban@gmail.com">axellaban@gmail.com</a>
      </p>

      <p className="legal-volver legal-volver-fin">
        <Link href="/">← Volver a Loreado.IA</Link>
      </p>
    </main>
  );
}

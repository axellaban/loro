# Loros 🦜

**Envía Loros, no mensajes.**

Mensajería donde el mensaje vuela. Tu ave despega desde tu ubicación real y
tarda lo que tiene que tardar hasta el nido de la otra persona. Hasta que no
aterriza, el mensaje **no existe** del otro lado.

> Es un proyecto aparte de Loreado.IA (lo que vive en la raíz de este repo). No
> comparten código, ni datos, ni deploy.

---

## Las cuatro aves

Cuanto más rápido vuela, menos le entra en la cabeza. Ese canje es todo el
diseño del producto: elegir el ave es parte del mensaje.

| Ave | Velocidad | Máximo | Es… |
|---|---|---|---|
| **Perico** ⚡ | 90 km/h | 120 caracteres | El express |
| **Cotorra** 💬 | 60 km/h | 400 caracteres | La charlatana |
| **Loro** 🦜 | 40 km/h | 1000 caracteres | El clásico |
| **Guacamayo** 👑 | 25 km/h | 2000 caracteres | El ceremonioso |

Y el 0,2% de los loros no llega nunca. Es poco. No es cero.

Las velocidades **no** son ornitología — un guacamayo de verdad vuela más
rápido que un perico. Son balance de juego, y viven todas en
[`lib/aves.ts`](lib/aves.ts): cambiás un número ahí y se corrigen solos la
landing, los ETA, el contador de caracteres y el color de la ruta en el mapa.

Cuánto tarda de verdad:

| Trayecto | Perico | Cotorra | Loro | Guacamayo |
|---|---|---|---|---|
| Cruzar la ciudad (8,4 km) | 5 min | 8 min | 13 min | 21 min |
| Buenos Aires → Montevideo (205 km) | 2 h 17 | 3 h 25 | 5 h 8 | 8 h 12 |
| Buenos Aires → Madrid (10.045 km) | 4 d 15 h | 6 d 23 h | 10 d 11 h | 16 d 17 h |

Sí: cruzar el Atlántico son días. Esa es la idea. Para mostrar la app sin
esperar, cada envío tiene un **vuelo de prueba** (ver más abajo).

## Correr local

```bash
npm install
npm run dev      # http://localhost:3001
```

No hace falta configurar nada: sin variables de entorno los datos van a
`.data/loros.json` y el mapa usa mosaicos de OpenStreetMap vía CARTO, que no
piden API key. Todas las variables opcionales están en
[`.env.example`](.env.example).

```bash
npm run typecheck   # tsc --noEmit
npm run prueba      # prueba de punta a punta contra la API (con el server corriendo)
```

## El 0,2%

Dos de cada mil loros no llegan. Se pierden en algún punto del camino —entre el
15% y el 85% del trayecto, para que no sea ni un chiste al despegar ni una
crueldad rozando el destino— y ese mensaje se perdió de verdad: quien lo
esperaba nunca sabe qué decía, no hay reintento automático ni copia guardada de
su lado. Quien lo mandó recupera su texto y puede volver a intentarlo.

El sorteo pasa una sola vez, al soltar el ave, y el resultado queda escrito: si
se decidiera al mirar, dos personas mirando el mismo vuelo obtendrían
respuestas distintas. Pero **no viaja al navegador hasta que ocurre** — si se
mandara desde el principio, abrir las herramientas de desarrollo diría de
antemano que ese loro no va a llegar, y esperar algo que ya sabés que no llega
no es esperar.

Se puede pisar con `LOROS_PROB_EXTRAVIO` (0 a 1) para probar ese camino sin
mandar quinientos loros:

```bash
LOROS_PROB_EXTRAVIO=1 npm run start   # todos se pierden
npm run prueba                        # la suite detecta el modo y lo verifica
```

## Ubicación y privacidad

Es el punto delicado del producto, así que está separado en dos cosas
distintas: **la app sabe dónde estás; tus contactos, no.**

- El servidor guarda las coordenadas exactas y calcula el vuelo con ellas.
- Lo que sale hacia el navegador de otra persona es un punto **corrido al azar
  hasta 3 km** ([`lib/privacidad.ts`](lib/privacidad.ts)), y el mapa dibuja ese
  círculo en lugar de un pin. El desvío es fijo por nido: si cambiara en cada
  consulta, con unas cuantas muestras se podría promediar el centro y recuperar
  la posición real.
- El nombre de lugar que se comparte es a nivel ciudad ("Palermo, Argentina"),
  nunca una dirección.
- **La distancia y el tiempo de vuelo sí son exactos**: se calculan en el
  servidor con los puntos reales y viajan ya resueltos, así que el "205 km" es
  cierto aunque el dibujo sea aproximado.
- Tu propio nido lo ves exacto. Es tu dato.

Lo que esto no cubre, dicho derecho: el desvío es constante, así que si te
mudás de ciudad, quien te tenga agregado ve que te moviste (a una zona
equivocada, pero se nota el movimiento). Para un MVP donde solo te ve gente a
la que le diste tu código, es el canje razonable.

## Cómo se usa

1. **Armá tu nido**: nombre, ubicación y ave preferida. No hay registro ni
   contraseña — un id firmado en una cookie y listo.
2. **Sumá gente**: cada nido tiene un código de 6 (`Compartir` lo manda por
   WhatsApp). El otro lo pega en *Bandada → Agregar por código*.
3. **Soltá un loro**: elegís destinatario y ave. Antes de mandar ya ves cuánto
   tarda cada una hasta esa persona en particular.
4. **Seguí el vuelo**: el ave cruza el mapa en vivo, con lo recorrido, lo que
   falta y el contador. Los dos ven la misma ave en el mismo lugar.
5. **Aterriza**: recién ahí se abre el mensaje. Al otro le llegan dos avisos:
   uno al despegar ("viene un loro, llega en 4 h") y otro al aterrizar. El
   primero importa tanto como el segundo — saber que algo está en camino es la
   mitad del producto.

**Doña Cotorra** es una vecina automática que aparece sola a 2,2 km de tu nido
cuando te registrás, y contesta con la misma ave que le mandaste. Existe para
que la primera persona que entra tenga a quién escribirle.

### El vuelo de prueba

Un mensaje a Madrid tarda días. Eso está bien para el producto y es un
problema para mostrarlo, así que cada envío puede marcarse como *vuelo de
prueba*: comprime el viaje hasta que el ave **más lenta** entre en unos 3
minutos, y aplica ese mismo factor a las cuatro. Las proporciones entre
especies quedan intactas — el perico sigue llegando en un tercio de lo que
tarda el guacamayo, sea el trayecto de 2 km o de 10.000.

No es un `×60`: con un multiplicador fijo, cualquier trayecto corto se
aplastaba contra el piso de 25 segundos y las cuatro aves daban el mismo
tiempo, que es exactamente lo que la app existe para diferenciar.

## ¿Y el login con Google?

Las apps de este tipo (Roost, Carrier Pigeon) piden login con Gmail. Acá no, y
es una decisión, no una omisión.

Lo que el login realmente resuelve en estas apps son dos cosas:

1. **Que no le puedas escribir a un desconocido.** Eso ya está resuelto sin
   login: para mandarle un loro a alguien tiene que estar en tu bandada, y para
   entrar a tu bandada hace falta su código de 6. El servidor lo verifica en
   cada envío — el id de un nido ajeno no alcanza para escribirle.
2. **Que no pierdas tu cuenta al cambiar de dispositivo.** Ese sí era un
   agujero real, y se tapa con la **llave del nido**: un link firmado
   (`/entrar?llave=…`) que abrís en el otro dispositivo y te deja el nido ahí,
   con su código, su bandada y su historial. Está en el panel, bajo tu código.

El canje, dicho sin vueltas: la llave **es** el nido, así que quien la tenga
entra. La interfaz lo dice con esas palabras al copiarla. Un login con Google
evita ese riesgo y a cambio pone una pantalla de registro antes de que la
persona vea el mapa — que para algo que se pasa por WhatsApp es donde se cae la
mitad de la gente. Si mañana el producto lo pide, agregarlo es un endpoint más:
`lib/sesion.ts` ya emite y valida sesiones firmadas, y lo único que cambia es
de dónde sale el id.

## Cómo está hecho

Next.js 14 (App Router), TypeScript, Leaflet. Sin base de datos obligatoria,
sin login, sin dependencias de UI.

```
lib/aves.ts       la tabla de las cuatro especies. Todo sale de acá.
lib/vuelo.ts      la fórmula del vuelo. Pura, y la usan servidor Y navegador:
                  si no fueran la misma cuenta, la app prometería un tiempo
                  y cumpliría otro.
lib/geo.ts        haversine, ruta de círculo máximo, rumbo, formatos.
lib/datos.ts      nidos, amistades, loros, Doña Cotorra.
lib/store.ts      persistencia: Upstash si hay credenciales, si no un archivo.
lib/vista.ts      qué ve el navegador. Acá se decide qué NO viaja: ni el texto
                  de un loro en vuelo, ni las coordenadas exactas de nadie.
lib/privacidad.ts el desvío fijo que convierte un punto en una zona.
lib/sesion.ts     identidad: un id firmado con HMAC en una cookie HttpOnly.
lib/geocode.ts    coordenadas → "Palermo, Argentina" (Nominatim, best-effort).

app/page.tsx      la portada.
app/nido/         la app.
app/api/          estado, nido, amigos, loros, loros/leer, ubicacion, sesion.
app/entrar/       canjea la llave del nido y redirige al mapa.

components/Mapa.tsx        Leaflet: nidos, rutas y aves animadas.
components/Compositor.tsx  elegir ave y escribir. La pantalla clave.
components/Panel.tsx       en vuelo / buzón / bandada.
components/Onboarding.tsx  los tres pasos para tener nido.
components/Ave.tsx         el ave dibujada, una forma y cuatro colores.
```

Los cuatro loros son SVG escritos a mano en
[`components/Ave.tsx`](components/Ave.tsx), en una sola pose de vuelo. Se
escriben como texto y no como JSX porque el marcador de Leaflet necesita HTML
crudo, y tener el mismo dibujo en dos lugares es la forma más rápida de que se
despeguen. Lo que distingue a una especie de otra a 34 píxeles no es el color
sino la silueta: la cola del guacamayo, las rayas del perico, el abanico de la
cotorra.

### Dos decisiones que explican casi todo

**Lo que no tiene que verse, no viaja.** Un loro en el aire llega al navegador
sin su texto, y ningún nido ajeno llega con sus coordenadas reales
([`lib/vista.ts`](lib/vista.ts)). Si viajaran igual y la pantalla los tapara,
abrir las herramientas de desarrollo alcanzaría para leer antes de tiempo o
para sacar la dirección de alguien. `npm run prueba` verifica las dos cosas.

**La posición del ave no viene del servidor.** Viene de la fórmula: con la hora
de salida, la de llegada y los dos puntos, el navegador calcula dónde está en
cada cuadro. Por eso el ave se mueve a 60 fps mientras la app consulta el
estado cada 4 segundos, y por eso las dos personas ven el mismo vuelo con el
mismo avance al mismo tiempo (cada una con su punta exacta y la del otro
corrida, así que las líneas difieren por unos kilómetros que nadie nota). El
servidor manda su reloj en cada respuesta, así un celular con la hora corrida
no ve un ETA falso.

## Mapa y ubicación

- **Mosaicos**: CARTO sobre OpenStreetMap, sin API key. Si cargás
  `NEXT_PUBLIC_MAPBOX_TOKEN`, usa Mapbox. Si no cargan (sin internet, red que
  los bloquea), el mapa avisa y los vuelos se siguen viendo igual sobre el
  fondo.
- **Ubicación**: la API de geolocalización del navegador, pedida en el paso 2
  del onboarding y no al entrar — sin contexto, la gente aprieta "bloquear". Si
  la deniegan hay una alternativa: marcar el nido a mano tocando el mapa.
- **Nombre del lugar**: Nominatim (OpenStreetMap), sin key, con cola de 1
  pedido por segundo y caché. Es opcional: si falla, el nido muestra sus
  coordenadas y nada más.

## Deploy

En cualquier lado que corra Next.js. En Vercel: proyecto nuevo con **Root
Directory = `loros`**, y cargar `LOROS_SECRET` y las dos variables de Upstash
(en serverless el archivo local no sirve: disco de solo lectura y cada pedido
puede caer en otra instancia).

## Lo que este MVP no es

- **Sin cuentas.** La identidad es una cookie. La llave del nido te la lleva a
  otro dispositivo, pero si borrás el navegador y no guardaste la llave, se
  perdió.
- **Sin cifrado de punta a punta.** El servidor ve los mensajes.
- **El rate limit es por proceso** (en memoria), así que frena el abuso obvio
  y no un ataque distribuido.
- **Con el backend de archivo, un solo proceso.** Dos instancias contra el
  mismo archivo tienen ventana de carrera; para eso está Upstash.
- **Sin push de verdad.** Los avisos de despegue y aterrizaje usan la API de
  notificaciones del navegador, que solo dispara con la app abierta. Un
  guacamayo de 16 días necesita un service worker + Web Push (VAPID) para que
  el aviso llegue con el teléfono en el bolsillo. Es el próximo paso obvio y no
  entra en un MVP.

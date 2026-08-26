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

## Cómo se usa

1. **Armá tu nido**: nombre, ubicación y ave preferida. No hay registro ni
   contraseña — un id firmado en una cookie y listo.
2. **Sumá gente**: cada nido tiene un código de 6 (`Compartir` lo manda por
   WhatsApp). El otro lo pega en *Bandada → Agregar por código*.
3. **Soltá un loro**: elegís destinatario y ave. Antes de mandar ya ves cuánto
   tarda cada una hasta esa persona en particular.
4. **Seguí el vuelo**: el ave cruza el mapa en vivo, con lo recorrido, lo que
   falta y el contador. Los dos ven la misma ave en el mismo lugar.
5. **Aterriza**: recién ahí se abre el mensaje.

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
lib/vista.ts      qué ve el navegador. Acá se decide qué NO viaja.
lib/sesion.ts     identidad: un id firmado con HMAC en una cookie HttpOnly.
lib/geocode.ts    coordenadas → "Palermo, Argentina" (Nominatim, best-effort).

app/page.tsx      la portada.
app/nido/         la app.
app/api/          estado, nido, amigos, loros, loros/leer, ubicacion.

components/Mapa.tsx        Leaflet: nidos, rutas y aves animadas.
components/Compositor.tsx  elegir ave y escribir. La pantalla clave.
components/Panel.tsx       en vuelo / buzón / bandada.
components/Onboarding.tsx  los tres pasos para tener nido.
components/Ave.tsx         el ave dibujada, una forma y cuatro colores.
```

### Dos decisiones que explican casi todo

**El texto no viaja antes de tiempo.** Un loro en el aire llega al navegador
sin su texto: el servidor no lo manda ([`lib/vista.ts`](lib/vista.ts)). Si
viajara igual y la pantalla lo tapara, abrir las herramientas de desarrollo
alcanzaría para leer antes, y la espera dejaría de ser real. `npm run prueba`
verifica justamente esto.

**La posición del ave no viene del servidor.** Viene de la fórmula: con la hora
de salida, la de llegada y los dos puntos, el navegador calcula dónde está en
cada cuadro. Por eso el ave se mueve a 60 fps mientras la app consulta el
estado cada 4 segundos, y por eso las dos personas ven exactamente la misma
ave en el mismo lugar. El servidor manda su reloj en cada respuesta, así un
celular con la hora corrida no ve un ETA falso.

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

- **Sin cuentas.** La identidad es una cookie: si la borrás, perdés el nido.
- **Sin cifrado de punta a punta.** El servidor ve los mensajes.
- **El rate limit es por proceso** (en memoria), así que frena el abuso obvio
  y no un ataque distribuido.
- **Con el backend de archivo, un solo proceso.** Dos instancias contra el
  mismo archivo tienen ventana de carrera; para eso está Upstash.
- **Sin notificaciones push reales**: usa las del navegador, que solo llegan
  con la pestaña abierta. Un guacamayo de 16 días necesita push de verdad.

// Prueba de punta a punta contra la API, con dos personas de verdad.
//
// Lo que de verdad se está chequeando es una sola cosa, la que sostiene el
// producto: que el texto de un loro NO llegue al navegador de quien lo recibe
// hasta que el ave aterriza. Si eso se rompe algún día, esta prueba lo dice.
//
//   npm run dev           (en otra terminal)
//   npm run prueba
//
// Deja tres nidos de mentira en .data/loros.json. Para limpiar: rm -rf .data

const BASE = process.env.LOROS_URL || "http://localhost:3001";

function cliente(nombre) {
  let cookie = "";
  return {
    nombre,
    async llamar(ruta, datos) {
      const r = await fetch(BASE + ruta, {
        method: datos ? "POST" : "GET",
        headers: {
          ...(datos ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { cookie } : {}),
          origin: BASE,
        },
        body: datos ? JSON.stringify(datos) : undefined,
      });
      const set = r.headers.getSetCookie?.() ?? [r.headers.get("set-cookie")].filter(Boolean);
      if (set.length) cookie = set[0].split(";")[0];
      const j = await r.json();
      if (!r.ok) throw new Error(`${ruta} → ${r.status}: ${j.error}`);
      return j;
    },
  };
}

const ok = (c, m) => console.log(`${c ? "✓" : "✗"} ${m}`);
let fallos = 0;
const chequear = (c, m) => { if (!c) fallos++; ok(c, m); };

// --- alta de las dos puntas ---
const ana = cliente("Ana");
const beto = cliente("Beto");
await ana.llamar("/api/nido", { nombre: "Ana", ave: "loro", lat: -34.6037, lng: -58.3816 });   // Buenos Aires
await beto.llamar("/api/nido", { nombre: "Beto", ave: "cotorra", lat: -34.9011, lng: -56.1645 }); // Montevideo

const estAna = await ana.llamar("/api/estado");
const estBeto = await beto.llamar("/api/estado");
console.log(`  Ana ${estAna.codigo} · Beto ${estBeto.codigo}`);
chequear(estAna.codigo !== estBeto.codigo, "cada nido tiene su propio código");
chequear(estAna.amigos.some((a) => a.bot), "a Ana le crearon su Doña Cotorra");

// --- amistad por código ---
const sumado = await beto.llamar("/api/amigos", { codigo: estAna.codigo });
chequear(sumado.amigo.nombre === "Ana", "Beto sumó a Ana con el código");
const anaAhora = await ana.llamar("/api/estado");
chequear(anaAhora.amigos.some((a) => a.id === sumado.amigo.id) === false, "(control) Ana no se agrega a sí misma");
chequear(anaAhora.amigos.some((a) => a.nombre === "Beto"), "la amistad quedó de los dos lados");

// --- código inexistente y código propio ---
for (const [codigo, motivo] of [["ZZZZZZ", "código inexistente"], [estBeto.codigo, "código propio"]]) {
  try { await beto.llamar("/api/amigos", { codigo }); chequear(false, `rechaza ${motivo}`); }
  catch { chequear(true, `rechaza ${motivo}`); }
}

// --- mandar a alguien que no es de la bandada ---
const carla = cliente("Carla");
await carla.llamar("/api/nido", { nombre: "Carla", ave: "perico", lat: 40.4168, lng: -3.7038 });
try {
  await carla.llamar("/api/loros", { para: sumado.amigo.id, ave: "perico", texto: "hola" });
  chequear(false, "bloquea escribirle a un nido ajeno");
} catch (e) { chequear(String(e).includes("403"), "bloquea escribirle a un nido ajeno"); }

// --- exceso de caracteres ---
try {
  await ana.llamar("/api/loros", {
    para: anaAhora.amigos.find((a) => a.nombre === "Beto").id,
    ave: "perico", texto: "x".repeat(121),
  });
  chequear(false, "el perico rechaza más de 120 caracteres");
} catch { chequear(true, "el perico rechaza más de 120 caracteres"); }

// --- el vuelo ---
const idBeto = anaAhora.amigos.find((a) => a.nombre === "Beto").id;
const SECRETO = "Esto no lo puede leer Beto hasta que aterrice el ave.";
const envio = await ana.llamar("/api/loros", { para: idBeto, ave: "perico", texto: SECRETO, turbo: true });
const vuelo = envio.loro;
const segundos = Math.round((vuelo.llegada - vuelo.salida) / 1000);
console.log(`  vuelo de ${Math.round(vuelo.distanciaKm)} km · ${segundos} s (vuelo de prueba)`);

const enVueloBeto = (await beto.llamar("/api/estado")).loros.find((l) => l.id === vuelo.id);
chequear(!!enVueloBeto, "a Beto le aparece el loro en el aire");
chequear(enVueloBeto.texto === null, "EL TEXTO NO VIAJA mientras el ave vuela");
chequear(enVueloBeto.llego === false, "figura como en vuelo");
chequear(enVueloBeto.otro.nombre === "Ana", "sabe de quién viene");

const enVueloAna = (await ana.llamar("/api/estado")).loros.find((l) => l.id === vuelo.id);
chequear(enVueloAna.texto === SECRETO, "Ana sí ve su propio texto desde el minuto cero");

// --- leer antes de tiempo ---
try {
  const r = await beto.llamar("/api/loros/leer", { id: vuelo.id });
  chequear(r.loro.texto === null, "abrirlo antes de tiempo no revela nada");
} catch { chequear(true, "abrirlo antes de tiempo no revela nada"); }

// --- esperar el aterrizaje ---
console.log(`  esperando ${segundos + 4} s…`);
await new Promise((r) => setTimeout(r, (segundos + 4) * 1000));

const llegado = (await beto.llamar("/api/estado")).loros.find((l) => l.id === vuelo.id);
chequear(llegado.llego === true, "aterrizó");
chequear(llegado.texto === SECRETO, "recién ahora Beto lee el mensaje");

const leido = await beto.llamar("/api/loros/leer", { id: vuelo.id });
chequear(!!leido.loro.leido, "queda marcado como leído");

// --- Carla no ve nada de esto ---
const deCarla = await carla.llamar("/api/estado");
chequear(!deCarla.loros.some((l) => l.id === vuelo.id), "un tercero no ve el loro ajeno");

console.log(fallos ? `\n${fallos} FALLO(S)` : "\nTodo en verde ✓");
process.exit(fallos ? 1 : 0);

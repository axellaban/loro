// Dónde viven los datos.
//
// Dos backends, elegidos solos según lo que haya configurado:
//
//   Upstash Redis  si están las variables (KV_REST_API_URL / _TOKEN). Es el
//                  modo para producción: varias instancias serverless comparten
//                  el mismo estado. Se usa la API REST y no el cliente oficial
//                  porque es un `fetch` contra una URL — cero dependencias.
//
//   Archivo        si no. Todo vive en memoria del proceso y se vuelca a
//                  .data/loros.json cada tanto, para que `npm run dev` no
//                  pierda los nidos al reiniciar. Es el modo "clonás el repo y
//                  anda", sin cuenta en ningún lado.
//
// Si el disco no se deja escribir (Vercel sin Upstash, por ejemplo) el archivo
// se apaga solo y queda todo en memoria: la app sigue funcionando, pero los
// datos duran lo que dure la instancia. Se avisa por consola una vez.

import { promises as fs } from "node:fs";
import path from "node:path";

export interface Backend {
  leer(clave: string): Promise<string | null>;
  escribir(clave: string, valor: string): Promise<void>;
  borrar(clave: string): Promise<void>;
  /** Varias claves de una. Evita N viajes de ida y vuelta al abrir un buzón. */
  leerVarios(claves: string[]): Promise<(string | null)[]>;
  /** Agrega al principio de una lista y la recorta. Atómico donde importa. */
  agregarALista(clave: string, valor: string, max: number): Promise<void>;
  leerLista(clave: string): Promise<string[]>;
  nombre: string;
}

// ---------- Upstash ----------

function credencialesUpstash(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

function backendUpstash(c: { url: string; token: string }): Backend {
  async function cmd(args: (string | number)[]): Promise<any> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    try {
      const r = await fetch(c.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${c.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args.map(String)),
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!r.ok) {
        console.error(`[store] ${args[0]} devolvió ${r.status}`);
        return undefined;
      }
      return (await r.json())?.result;
    } catch (err: any) {
      console.error(`[store] ${args[0]} falló:`, err?.message || err);
      return undefined;
    } finally {
      clearTimeout(t);
    }
  }

  return {
    nombre: "upstash",
    async leer(clave) {
      const r = await cmd(["GET", clave]);
      return typeof r === "string" ? r : null;
    },
    async leerVarios(claves) {
      if (claves.length === 0) return [];
      const r = await cmd(["MGET", ...claves]);
      if (!Array.isArray(r)) return claves.map(() => null);
      return r.map((x) => (typeof x === "string" ? x : null));
    },
    async escribir(clave, valor) {
      await cmd(["SET", clave, valor]);
    },
    async borrar(clave) {
      await cmd(["DEL", clave]);
    },
    async agregarALista(clave, valor, max) {
      await cmd(["LPUSH", clave, valor]);
      await cmd(["LTRIM", clave, 0, max - 1]);
    },
    async leerLista(clave) {
      const r = await cmd(["LRANGE", clave, 0, -1]);
      return Array.isArray(r) ? r.map(String) : [];
    },
  };
}

// ---------- Archivo (+ memoria) ----------

function backendArchivo(): Backend {
  const dir = process.env.LOROS_DATA_DIR || path.join(process.cwd(), ".data");
  const archivo = path.join(dir, "loros.json");

  type Datos = Record<string, string | string[]>;

  // El disco manda, no la memoria. Parece más lento y es lo correcto: en
  // `next dev` cada ruta puede terminar con su propia copia del módulo, así que
  // un mapa en memoria hace que /api/loros no vea los nidos que creó
  // /api/nido. (Pasó. El síntoma era un 401 "todavía no tenés nido" con la
  // cookie perfectamente válida.) Con estos volúmenes, leer un JSON chico por
  // pedido no se nota.
  let cache: { mtime: number; datos: Datos } | null = null;
  // Solo si el disco no se deja escribir. Es la red de contención, no el modo
  // normal de funcionar.
  let memoriaSola = false;
  const memoria: Datos = {};

  async function leerTodo(): Promise<Datos> {
    if (memoriaSola) return memoria;
    try {
      const st = await fs.stat(archivo);
      if (cache && cache.mtime === st.mtimeMs) return cache.datos;
      const datos = JSON.parse(await fs.readFile(archivo, "utf8")) as Datos;
      cache = { mtime: st.mtimeMs, datos };
      return datos;
    } catch {
      // No existe todavía, o quedó ilegible. Se arranca vacío: perder un MVP de
      // nidos no justifica no arrancar.
      return cache?.datos ?? {};
    }
  }

  async function guardar(datos: Datos): Promise<void> {
    if (memoriaSola) return;
    try {
      await fs.mkdir(dir, { recursive: true });
      const tmp = `${archivo}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(datos), "utf8");
      // rename es atómico: quien lea mientras tanto nunca ve un JSON a medias.
      await fs.rename(tmp, archivo);
      cache = null;
    } catch (err: any) {
      memoriaSola = true;
      Object.assign(memoria, datos);
      console.warn(
        `[store] no se puede escribir ${archivo} (${err?.message}). Sigo solo en memoria: los datos duran lo que dure el proceso. Para que persistan, configurá Upstash.`
      );
    }
  }

  // Las escrituras van de a una. Sin esto, dos loros soltados al mismo tiempo
  // hacen leer-modificar-escribir en paralelo y el segundo pisa al primero.
  //
  // Vale dentro de este proceso. Si mañana corren dos instancias contra el
  // mismo archivo, la ventana vuelve: para eso está Upstash.
  let cola: Promise<unknown> = Promise.resolve();
  function mutar(fn: (datos: Datos) => void): Promise<void> {
    const siguiente = cola.then(async () => {
      const datos = await leerTodo();
      const copia: Datos = { ...datos };
      fn(copia);
      await guardar(copia);
    });
    // La cola no se puede cortar por un error: si una escritura falla, las que
    // vienen atrás tienen que correr igual.
    cola = siguiente.catch(() => {});
    return siguiente;
  }

  return {
    nombre: "archivo",
    async leer(clave) {
      const v = (await leerTodo())[clave];
      return typeof v === "string" ? v : null;
    },
    async leerVarios(claves) {
      const datos = await leerTodo();
      return claves.map((k) => {
        const v = datos[k];
        return typeof v === "string" ? v : null;
      });
    },
    async escribir(clave, valor) {
      await mutar((d) => {
        d[clave] = valor;
      });
    },
    async borrar(clave) {
      await mutar((d) => {
        delete d[clave];
      });
    },
    async agregarALista(clave, valor, max) {
      await mutar((d) => {
        const actual = d[clave];
        const lista = Array.isArray(actual) ? [...actual] : [];
        lista.unshift(valor);
        d[clave] = lista.slice(0, max);
      });
    },
    async leerLista(clave) {
      const v = (await leerTodo())[clave];
      return Array.isArray(v) ? [...v] : [];
    },
  };
}

// ---------- elección ----------

let elegido: Backend | null = null;

export function store(): Backend {
  if (!elegido) {
    const c = credencialesUpstash();
    elegido = c ? backendUpstash(c) : backendArchivo();
  }
  return elegido;
}

/** Helpers de documentos JSON, que es como se guarda todo lo de la app. */
export async function leerDoc<T>(clave: string): Promise<T | null> {
  const crudo = await store().leer(clave);
  if (!crudo) return null;
  try {
    return JSON.parse(crudo) as T;
  } catch {
    return null;
  }
}

export async function escribirDoc(clave: string, valor: unknown): Promise<void> {
  await store().escribir(clave, JSON.stringify(valor));
}

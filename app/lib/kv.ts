// El único dato que el proyecto guarda: qué cuenta de Google tiene qué pase.
//
// Todo lo demás es sin estado a propósito (el pase lleva adentro sus propios
// datos, firmados). Pero para que el pase te siga entre dispositivos hace falta
// poder responder "esta cuenta pagó" desde un navegador que nunca vio el
// código: eso no se puede deducir, hay que tenerlo anotado.
//
// Se usa la API REST de Upstash en vez del cliente oficial porque es un `fetch`
// contra una URL: no suma dependencias al package.json y anda igual en el
// runtime edge, donde corre todo el resto.
//
// Si las variables no están cargadas, `disponible()` da false y quien llama
// sigue de largo: sin almacenamiento el pase funciona como siempre (atado al
// navegador). Nunca se rompe la app por un problema de infraestructura.

function creds(): { url: string; token: string } | null {
  // Dos juegos de nombres: los que pone la integración de Upstash del
  // Marketplace de Vercel, y los de una cuenta de Upstash conectada a mano.
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

export function disponible(): boolean {
  return creds() !== null;
}

/**
 * Por qué no hay almacenamiento, para los endpoints de diagnóstico. Nunca
 * devuelve el token ni nada derivado de él.
 */
export function motivoNoDisponible(): string {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url && !token) {
    return "Falta la base Upstash en este deploy (KV_REST_API_URL y KV_REST_API_TOKEN). Agregá Upstash desde el Marketplace de Vercel y REDEPLOYÁ: las variables nuevas no entran en un deploy ya hecho.";
  }
  if (!url) return "Falta KV_REST_API_URL en este deploy.";
  if (!token) return "Falta KV_REST_API_TOKEN en este deploy.";
  return "";
}

/**
 * Manda un comando a Upstash. Devuelve `undefined` si no hay credenciales o si
 * la llamada falla: el que llama decide qué hacer, y en todos los casos de esta
 * app la decisión es "seguir sin almacenamiento".
 */
async function cmd(args: (string | number)[]): Promise<any> {
  const c = creds();
  if (!c) return undefined;
  // Con tope: este pedido está en el camino del login y del canje. Si Upstash
  // se cuelga (que es distinto de fallar), la persona no puede entrar.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(c.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args.map(String)),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!r.ok) {
      console.error(`[kv] ${args[0]} devolvió ${r.status}`);
      return undefined;
    }
    const j: any = await r.json();
    return j?.result;
  } catch (err: any) {
    console.error(`[kv] ${args[0]} falló:`, err?.message || err);
    return undefined;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Varios comandos en UN solo viaje a Upstash.
 *
 * Lo pide el contador de gasto: cada respuesta de un modelo suma media docena
 * de campos (total, total por proveedor, pedidos, tokens, vencimiento) y
 * mandarlos de a uno serían seis viajes en el camino de una respuesta que la
 * persona está esperando. Devuelve un resultado por comando, en orden, o
 * `undefined` si no hay credenciales o falló la llamada entera.
 */
export async function pipeline(comandos: (string | number)[][]): Promise<any[] | undefined> {
  const c = creds();
  if (!c || comandos.length === 0) return undefined;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(`${c.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(comandos.map((cmd) => cmd.map(String))),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!r.ok) {
      console.error(`[kv] pipeline devolvió ${r.status}`);
      return undefined;
    }
    const j: any = await r.json();
    return Array.isArray(j) ? j.map((x) => x?.result) : undefined;
  } catch (err: any) {
    console.error("[kv] pipeline falló:", err?.message || err);
    return undefined;
  } finally {
    clearTimeout(t);
  }
}

export async function get(key: string): Promise<string | null> {
  const r = await cmd(["GET", key]);
  return typeof r === "string" ? r : null;
}

/** Guarda con vencimiento. El TTL mantiene la base limpia sola. */
export async function set(key: string, value: string, ttlSegundos: number): Promise<boolean> {
  const r = await cmd(["SET", key, value, "EX", Math.max(1, Math.floor(ttlSegundos))]);
  return r === "OK";
}

/**
 * Guarda SOLO si la clave no existía (SET NX), y dice si ganó.
 *
 * Es la pieza que hace que "el primero que canjea se queda el pase" sea de
 * verdad el primero: leer-y-después-escribir tiene una ventana en la que dos
 * personas que pegan el mismo código al mismo tiempo se lo llevan las dos.
 * Redis resuelve el NX de forma atómica, así que no hay ventana.
 */
export async function setIfAbsent(
  key: string,
  value: string,
  ttlSegundos: number
): Promise<boolean> {
  const r = await cmd(["SET", key, value, "NX", "EX", Math.max(1, Math.floor(ttlSegundos))]);
  return r === "OK";
}

export async function del(key: string): Promise<void> {
  await cmd(["DEL", key]);
}

/** Chequeo de ida y vuelta para los endpoints de diagnóstico. */
export async function ping(): Promise<boolean> {
  return (await cmd(["PING"])) === "PONG";
}

/**
 * Huella corta y estable de un texto. Se usa para no guardar el código del
 * pase en claro: para saber si YA fue reclamado alcanza con su huella, y así la
 * base no tiene adentro nada que sirva para entrar a la app.
 */
export async function huella(texto: string): Promise<string> {
  const d = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto))
  );
  let out = "";
  for (let i = 0; i < 16; i++) out += d[i].toString(16).padStart(2, "0");
  return out;
}

// Email desbloqueado, compartido entre el simulador y el copiloto.
//
// Los dos piden el email una sola vez para desbloquear su informe. Antes cada
// uno guardaba el suyo, así que quien ya lo había dejado en el simulador volvía
// a encontrarse la misma pared en el copiloto — pedir dos veces lo mismo es la
// forma más rápida de que no lo dejen ninguna de las dos.

const KEY = "loreado:email:v1";
// La clave vieja del simulador: se sigue leyendo (y escribiendo) para no
// volver a pedirle el email a quien ya lo dejó antes de este cambio.
const LEGACY_KEY = "simulador:email:v1";

export function savedEmail(): string {
  try {
    return localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY) || "";
  } catch {
    return "";
  }
}

export function rememberEmail(email: string) {
  try {
    localStorage.setItem(KEY, email);
    localStorage.setItem(LEGACY_KEY, email);
  } catch {
    // Storage bloqueado (incógnito con restricciones): se vuelve a preguntar
    // la próxima vez, que es preferible a romper el flujo.
  }
}

// Registro de emails en el Google Form.
//
// El formulario es la lista de contactos del proyecto: entran los de la lista
// de espera, los que desbloquean un informe del simulador y —desde que existe
// el login— los que entran con Google.
//
// Vivía suelto adentro de /api/waitlist. Ahora que lo llaman tres caminos
// distintos, está acá: un solo lugar donde cambiar el formulario el día que
// deje de ser un Google Form.

const ACTION =
  process.env.GFORM_ACTION ||
  "https://docs.google.com/forms/d/e/1FAIpQLSelOpUf5moBn1tDItWN6Jf37Ky47_4AJwNs5WqiS-E1zL1aqQ/formResponse";
const EMAIL_ENTRY = process.env.GFORM_EMAIL_ENTRY || "entry.73601750";

export type Registro = { ok: true } | { ok: false; error: string };

export async function registrarEmail(email: string): Promise<Registro> {
  try {
    const r = await fetch(ACTION, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ [EMAIL_ENTRY]: email }).toString(),
    });
    // Google Forms responde 200 (o un redirect que fetch sigue hasta 200).
    if (r.status < 400) return { ok: true };
    return { ok: false, error: `No se pudo registrar (HTTP ${r.status}).` };
  } catch {
    return { ok: false, error: "Error de red al registrar." };
  }
}

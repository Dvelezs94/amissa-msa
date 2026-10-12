import { parseWorkOrderFolioInput } from "@/lib/work-order-folio-helpers";

export type PublicOrderLookup =
  | { kind: "folio"; folio: string }
  | { kind: "email"; email: string };

const CONTACT_EMAIL =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Folio number, or the contact email saved on a public order. */
export function parsePublicOrderLookup(
  raw: string
): { ok: true; value: PublicOrderLookup } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Escribe el folio o el email de contacto." };
  }
  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    if (email.length > 254 || !CONTACT_EMAIL.test(email)) {
      return { ok: false, error: "Email no válido." };
    }
    return { ok: true, value: { kind: "email", email } };
  }
  const parsed = parseWorkOrderFolioInput(trimmed);
  if (!parsed) {
    return { ok: false, error: "Folio no válido." };
  }
  return { ok: true, value: { kind: "folio", folio: parsed.canonical } };
}

/**
 * Postgres/JS regex for the contact line written by POST /api/solicitud.
 * The address must end the line so `ana@correo.com` does not match `ana@correo.com.mx`.
 */
export function publicContactEmailLinePattern(email: string): string {
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `Email contacto: ${escaped}(\\r?\\n|$)`;
}

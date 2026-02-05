import { Actor } from "./types";

export function normalizePhone(value?: string | null) {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("00")) {
    return `+${digits.slice(2)}`;
  }
  return `+${digits}`;
}

export function isClientOwner(actor: Actor, clientEmail?: string | null, clientPhone?: string | null) {
  if (actor.email && clientEmail && actor.email === clientEmail) {
    return true;
  }
  if (actor.whatsapp && clientPhone) {
    return normalizePhone(actor.whatsapp) === normalizePhone(clientPhone);
  }
  return false;
}

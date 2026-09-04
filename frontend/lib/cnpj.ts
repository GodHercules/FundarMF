export function formatCnpj(value: string) {
  const raw = value.replace(/[^a-z0-9]/gi, "").toUpperCase();
  const clean = raw.slice(0, 12) + raw.slice(12).replace(/\D/g, "").slice(0, 2);
  let result = clean.slice(0, 2);
  if (clean.length > 2) result += `.${clean.slice(2, 5)}`;
  if (clean.length > 5) result += `.${clean.slice(5, 8)}`;
  if (clean.length > 8) result += `/${clean.slice(8, 12)}`;
  if (clean.length > 12) result += `-${clean.slice(12, 14)}`;
  return result;
}

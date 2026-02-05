export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function maskCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);
  let masked = part1;
  if (part2) masked += `.${part2}`;
  if (part3) masked += `.${part3}`;
  if (part4) masked += `-${part4}`;
  return masked;
}

export function maskPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  const ddd = digits.slice(0, 2);
  const part1 = digits.slice(2, 7);
  const part2 = digits.slice(7, 11);
  if (!ddd) return digits;
  if (!part1) return `(${ddd}`;
  if (!part2) return `(${ddd}) ${part1}`;
  return `(${ddd}) ${part1}-${part2}`;
}

export function maskPhoneNumberBR(value: string) {
  const digits = onlyDigits(value).slice(0, 9);
  const part1 = digits.slice(0, 5);
  const part2 = digits.slice(5, 9);
  if (!part1) return "";
  if (!part2) return part1;
  return `${part1}-${part2}`;
}

export function maskCep(value: string) {
  const digits = onlyDigits(value).slice(0, 8);
  const part1 = digits.slice(0, 5);
  const part2 = digits.slice(5, 8);
  if (!part2) return part1;
  return `${part1}-${part2}`;
}

export function maskCnae(value: string) {
  const digits = onlyDigits(value).slice(0, 7);
  const part1 = digits.slice(0, 4);
  const part2 = digits.slice(4, 5);
  const part3 = digits.slice(5, 7);
  if (!part2) return part1;
  if (!part3) return `${part1}-${part2}`;
  return `${part1}-${part2}/${part3}`;
}

export function maskIptu(value: string) {
  const digits = onlyDigits(value).slice(0, 12);
  return digits.replace(/(\d{3})(?=\d)/g, "$1.");
}

export function maskPercent(value: string) {
  const digits = onlyDigits(value).slice(0, 3);
  if (!digits) return "";
  const numeric = Math.min(100, Number(digits));
  return `${numeric}%`;
}

export function maskCurrency(value: string) {
  const digits = onlyDigits(value).slice(0, 14);
  if (!digits) return "";
  const number = Number(digits);
  const cents = (number % 100).toString().padStart(2, "0");
  const integer = Math.floor(number / 100);
  const integerFormatted = integer.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${integerFormatted},${cents}`;
}

export function sanitizeDecimalInput(raw: string, maxWholeDigits = 6, maxFractionDigits = 2): string {
  const cleaned = raw.replaceAll(/[^0-9.]/g, "");
  const [wholeRaw, ...fractionParts] = cleaned.split(".");
  const whole = wholeRaw.slice(0, maxWholeDigits);
  if (fractionParts.length === 0) return whole;
  const fraction = fractionParts.join("").slice(0, maxFractionDigits);
  return `${whole}.${fraction}`;
}

export function sanitizeDigitsOnly(raw: string, maxLength: number): string {
  return raw.replaceAll(/\D/g, "").slice(0, maxLength);
}

export function sanitizePhoneInput(raw: string, maxDigits = 15): string {
  const trimmed = raw.trimStart();
  const hasPlus = trimmed.startsWith("+");
  const digits = raw.replaceAll(/\D/g, "").slice(0, maxDigits);
  return hasPlus ? `+${digits}` : digits;
}

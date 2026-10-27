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

/**
 * Supabase's email code length (sign-up confirmation and password recovery) is a
 * project setting: 6 by default, up to 10. Hard-coding 6 means a project set to 8
 * can't finish signing up (27 Oct 2026; staging is set to 8). Web twin: RoleSignup.
 */
export const EMAIL_CODE_MIN = 6;
export const EMAIL_CODE_MAX = 10;
export function isEmailCode(code: string): boolean {
  return code.length >= EMAIL_CODE_MIN && code.length <= EMAIL_CODE_MAX && /^\d+$/.test(code);
}

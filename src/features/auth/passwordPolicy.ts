/**
 * Password rules — the single source of truth for sign-up, password reset and
 * any future change-password screen.
 *
 * Mirrors the web app exactly (`src/lib/validation.ts` and
 * `src/pages/ResetPassword.tsx`): at least 8 characters, containing both
 * letters and numbers. Keep the two in sync — a user who sets a password on
 * one client must be able to sign in and reset it on the other.
 *
 * Note this is intentionally looser than `validatePassword` in the backend's
 * `_shared/validation.ts` (which additionally requires mixed case). That
 * function only guards `POST /auth-handler/reset-password`, an endpoint
 * neither client calls — web and mobile both reset via
 * `supabase.auth.updateUser`. If anything ever starts calling it, these rules
 * have to be reconciled first.
 *
 * No imports: `npm test` runs this file's spec through Node's TS stripping,
 * which can't resolve the `@/` path alias.
 */

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters, with letters and numbers`;

/** Returns an error message, or null when the password is acceptable. */
export function validatePassword(password: string): string | null {
  if (!password) return "Password is required";
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must contain both letters and numbers";
  }
  return null;
}

/**
 * Confirm-field check. Only meaningful once the password itself is valid —
 * web suppresses the mismatch error while the password is still failing, so
 * the user fixes one problem at a time.
 */
export function validatePasswordConfirm(password: string, confirm: string): string | null {
  if (validatePassword(password)) return null;
  if (password !== confirm) return "Passwords do not match";
  return null;
}

export type PasswordStrength = {
  /** 0 = empty, 4 = strong. */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
};

const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"] as const;
const STRENGTH_COLORS = ["", "#ef4444", "#f59e0b", "#3b82f6", "#16a34a"] as const;

/**
 * Advisory strength score for the meter — deliberately NOT a gate. A password
 * can be "Weak" and still be accepted, exactly as on web; `validatePassword`
 * is the only thing that blocks submission.
 *
 * Same scoring as web's `PasswordStrengthMeter.scorePassword`.
 */
export function scorePassword(password: string): PasswordStrength {
  if (!password) return { score: 0, label: "", color: "" };
  let s = 0;
  if (password.length >= 8) s++;
  if (password.length >= 12) s++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) s++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) s++;
  const score = Math.min(4, s) as 0 | 1 | 2 | 3 | 4;
  return { score, label: STRENGTH_LABELS[score], color: STRENGTH_COLORS[score] };
}

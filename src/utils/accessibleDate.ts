/**
 * Spoken label for a calendar day cell: "Tuesday, November 4, 2026".
 *
 * A day cell renders only its number ("4"), which VoiceOver/TalkBack read as
 * "4, button" — no month, no weekday. Built by hand rather than with
 * `toLocaleDateString` options, whose output depends on the Intl data the JS
 * engine ships (Hermes builds differ).
 */
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export function accessibleDateLabel(d: Date): string {
  return `${WEEKDAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Dynamic Type cap for fixed-size cells (calendar days, 40×40 header buttons):
 *  large enough to help, small enough that the digit still fits its box. */
export const FIXED_CELL_MAX_FONT_SCALE = 1.4;

/**
 * When the weight-based suggestion may write into the fee field (web parity).
 *
 * - Send Parcel: it follows the weight until the user types in the field.
 * - Edit parcel: it only fills an EMPTY field, and only until the user types.
 *
 * "Types" includes clearing the field: before 2 Nov 2026 the edit screen had
 * no touched flag, so deleting the amount to type a new one snapped the
 * suggestion straight back and a new amount could not be entered (client).
 *
 * Returns the value to write, or null to leave the field alone.
 */
export function feeAutofill(
  form: "create" | "edit",
  touched: boolean,
  suggested: number | null,
  current: string,
): string | null {
  if (touched || suggested == null) return null;
  if (form === "edit" && current !== "") return null;
  const next = String(suggested);
  return next === current ? null : next;
}

/** Derives two-letter initials from a display name for avatars. */
export function initialsFromFullName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.at(-1)?.charAt(0) ?? "";
  return `${first}${last}`.toUpperCase();
}

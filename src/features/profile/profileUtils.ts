/** Derives two-letter initials from a display name for avatars. */
export function initialsFromFullName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.at(-1)?.charAt(0) ?? "";
  return `${first}${last}`.toUpperCase();
}

export interface ProfileFormSnapshot {
  name: string;
  bio: string;
  city: string;
  country: string | null;
  avatarUrl: string | null;
}

export interface StoredProfileFields {
  name?: string | null;
  bio?: string | null;
  city?: string | null;
  country?: string | null;
  avatar_url?: string | null;
}

/**
 * Save is enabled only when a value differs from the stored profile - typing
 * and then undoing it is "nothing to save" (web's isDirty, 28 Oct 2026).
 */
export function profileFormChanged(form: ProfileFormSnapshot, stored: StoredProfileFields | null | undefined): boolean {
  return (
    form.name !== (stored?.name ?? "") ||
    form.bio !== (stored?.bio ?? "") ||
    form.city !== (stored?.city ?? "") ||
    (form.country ?? "") !== (stored?.country ?? "") ||
    (form.avatarUrl ?? "") !== (stored?.avatar_url ?? "")
  );
}

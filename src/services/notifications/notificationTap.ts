/**
 * Opening a notification from outside the list (a push tap, the in-app banner)
 * marks it read, like a tap in the list does (29 Oct 2026). Pushes carry
 * `notification_id` from the server; an older push without it falls back to
 * the unread notices with that exact link (and type, when known). Pure, so it
 * runs under node --test; same rule on web (src/lib/notificationTap.ts).
 */
export interface NotificationTap {
  id?: string | null;
  link?: string | null;
  type?: string | null;
}

export interface TapCandidate {
  id: string;
  read?: boolean;
  type?: string | null;
  data?: { link?: string | null } | null;
}

export function tappedNotificationIds(tap: NotificationTap, list: readonly TapCandidate[]): string[] {
  if (tap.id) return [tap.id];
  if (!tap.link) return [];
  return list
    .filter((n) => !n.read && n.data?.link === tap.link && (!tap.type || n.type === tap.type))
    .map((n) => n.id);
}

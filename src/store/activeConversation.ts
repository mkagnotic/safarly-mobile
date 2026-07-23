/**
 * The conversation the user is currently viewing, if any.
 *
 * A plain module-level ref (not React state) so non-React code — the realtime
 * sync — can read it synchronously. It exists to suppress the in-app
 * new-message toast for the thread you're already in, which is standard chat
 * behaviour: you don't get a notification banner for the conversation on screen.
 *
 * The chat screen sets this on focus and clears it on blur.
 */
let activeConversationId: string | null = null;

export function setActiveConversation(id: string | null): void {
  activeConversationId = id;
}

export function getActiveConversation(): string | null {
  return activeConversationId;
}

/**
 * What to do about push on sign-in. Pure, so it is tested without React Native.
 *
 * Why it exists: production had 6 Android push tokens and 0 iOS. iOS starts
 * every app at "undetermined" and only shows its permission dialog when asked;
 * the app asked only from Preferences -> push toggle, which iPhone users never
 * had a reason to open (push is on by default). Android below 13 grants
 * notifications without asking, so it registered silently and hid the gap.
 *
 *   granted       -> register the token silently (as before)
 *   undetermined  -> ask ONCE - the OS shows its dialog; never again after
 *   denied        -> do nothing; the user decided (Preferences explains how to
 *                    re-enable in Settings)
 */
export type LoginPushAction = "register" | "ask" | "skip";

export function loginPushAction(status: string | undefined): LoginPushAction {
  if (status === "granted") return "register";
  if (status === "undetermined") return "ask";
  return "skip";
}

/**
 * How a push that arrives while the app is open is presented (27 Oct 2026).
 * Signed out: never shown. For the chat on screen: no banner/sound/list entry
 * (the message is already in front of the user), like every chat app.
 */
export function foregroundPresentation(s: {
  signedIn: boolean;
  conversationId?: string | null;
  activeConversationId: string | null;
}): { show: boolean; badge: boolean } {
  const forOpenChat = !!s.conversationId && s.conversationId === s.activeConversationId;
  return { show: s.signedIn && !forOpenChat, badge: s.signedIn };
}

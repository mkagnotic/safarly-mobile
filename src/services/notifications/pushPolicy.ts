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

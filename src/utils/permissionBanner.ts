import { Linking } from "react-native";

import { showAppAlert, showToast } from "@/feedback/appFeedback";

/**
 * Handling for a refused camera / photo-library permission.
 *
 * Android and iOS both stop showing the system prompt once a permission has been
 * refused for good (`canAskAgain: false`), so "Allow camera access to take a
 * photo" leaves the user with nothing to press — from that point the setting can
 * only be changed in the OS settings app. So: while we can still ask, keep the
 * short nudge; once we cannot, say it is turned off and offer a way there.
 *
 * Two shapes because the call sites differ. Screens that own a `FormBanner`
 * (KYC, avatar upload) render `permissionDeniedBanner` inline; screens that only
 * have transient toasts (chat, parcel review, travel docs) call
 * `notifyPermissionDenied`, which escalates to an alert precisely when there is
 * an action worth offering.
 */

export type PermissionKind = "camera" | "photos";

interface PermissionLike {
  status: string;
  canAskAgain?: boolean;
}

export interface PermissionBanner {
  variant: "warning";
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Opens this app's page in the OS settings app. */
export function openAppSettings(): void {
  // Never throws in practice, but a failed deep link must not take down the
  // screen the user is standing on.
  void Linking.openSettings().catch(() => {});
}

function isPermanentlyDenied(permission: PermissionLike): boolean {
  return permission.canAskAgain === false;
}

function deniedMessage(kind: PermissionKind, purpose: string, permanent: boolean): string {
  const subject = kind === "camera" ? "Camera" : "Photo";
  return permanent
    ? `${subject} access is turned off for Safarly. Turn it on in Settings to ${purpose}.`
    : `Allow ${subject.toLowerCase()} access to ${purpose}.`;
}

/**
 * Inline banner content for screens that render a `FormBanner`.
 *
 * `purpose` completes the sentence "…access to {purpose}" — pass the same words
 * the screen already used, e.g. "upload your document".
 */
export function permissionDeniedBanner(
  kind: PermissionKind,
  permission: PermissionLike,
  purpose: string,
): PermissionBanner {
  const permanent = isPermanentlyDenied(permission);
  return {
    variant: "warning",
    title: "Permission needed",
    message: deniedMessage(kind, purpose, permanent),
    ...(permanent ? { actionLabel: "Open Settings", onAction: openAppSettings } : {}),
  };
}

/**
 * Toast-or-alert for screens with no banner surface. A toast cannot carry a
 * button, so a permanent denial is raised as an alert instead — otherwise the
 * one piece of information the user needs would auto-dismiss.
 */
export function notifyPermissionDenied(
  kind: PermissionKind,
  permission: PermissionLike,
  purpose: string,
): void {
  const permanent = isPermanentlyDenied(permission);
  const message = deniedMessage(kind, purpose, permanent);

  if (!permanent) {
    showToast({ title: "Permission needed", message, variant: "warning" });
    return;
  }

  showAppAlert({
    title: "Permission needed",
    message,
    actions: [
      { text: "Not now", style: "cancel" },
      { text: "Open Settings", onPress: openAppSettings },
    ],
  });
}

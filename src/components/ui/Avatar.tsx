import { memo } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { VerifiedTick } from "@/components/ui/VerifiedTick";
import { colors } from "@/theme/colors";

/** Two-letter initials from a name; "?" when absent. Matches the app's other
 *  avatar fallbacks (chat, search) so the same person reads consistently. */
export function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface AvatarProps {
  name?: string | null;
  /** Remote photo URL. Falls back to initials when absent or null. */
  uri?: string | null;
  /** Diameter in px (default 40). */
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Identity check approved: blue tick on the top-right corner. */
  verified?: boolean | null;
}

/**
 * The verified tick as a corner badge on an avatar (client, 26 Oct 2026):
 * top-right, slightly over the edge, on a white ring so it reads on any photo.
 * Place it inside a non-clipping wrapper the size of the avatar. Screens that
 * draw their own avatar circle use this directly; `Avatar` uses it via `verified`.
 */
export function VerifiedAvatarBadge({ verified, avatarSize }: Readonly<{ verified?: boolean | null; avatarSize: number }>) {
  if (verified !== true) return null;
  const tick = Math.max(14, Math.round(avatarSize * 0.38));
  const ring = tick + 4;
  return (
    <View
      pointerEvents="none"
      style={[styles.badge, { width: ring, height: ring, borderRadius: ring / 2 }]}
    >
      <VerifiedTick verified size={tick} />
    </View>
  );
}

/**
 * Circular user avatar: renders the remote photo when a `uri` is present, else
 * an initials tile. Web parity — web's `UserAvatar` shows real `avatar_url`
 * photos; the mobile result cards used to drop them and always show initials.
 */
export const Avatar = memo(function Avatar({ name, uri, size = 40, style, verified }: Readonly<AvatarProps>) {
  const dims = { width: size, height: size, borderRadius: size / 2 };

  // Verified: the same circle, wrapped so the corner badge can sit over its edge
  // (the wrapper takes the caller's style for layout and never clips).
  if (verified === true) {
    return (
      <View style={[dims, style]}>
        <Avatar name={name} uri={uri} size={size} />
        <VerifiedAvatarBadge verified avatarSize={size} />
      </View>
    );
  }

  if (uri) {
    // Circle styling (radius/border/margin) is valid for both View and Image;
    // the RN types just don't unify ViewStyle/ImageStyle, hence the cast.
    return (
      <Image
        source={{ uri }}
        style={[dims, style as StyleProp<ImageStyle>]}
        accessibilityLabel={name ? `${name}'s photo` : "User photo"}
      />
    );
  }

  return (
    <View style={[styles.fallback, dims, style]}>
      <Text style={[styles.text, { fontSize: Math.round(size * 0.34) }]}>{getInitials(name)}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { color: colors.wordmark, fontWeight: "800" },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
});

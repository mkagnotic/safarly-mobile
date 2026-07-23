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
}

/**
 * Circular user avatar: renders the remote photo when a `uri` is present, else
 * an initials tile. Web parity — web's `UserAvatar` shows real `avatar_url`
 * photos; the mobile result cards used to drop them and always show initials.
 */
export const Avatar = memo(function Avatar({ name, uri, size = 40, style }: Readonly<AvatarProps>) {
  const dims = { width: size, height: size, borderRadius: size / 2 };

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
});

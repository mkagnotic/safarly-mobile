import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";

export interface SystemRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tone?: "neutral" | "good" | "bad";
  onPress?: () => void;
}

/**
 * Centered status line between messages — the standard chat treatment for
 * system events (WhatsApp/Telegram-style), rather than a message bubble.
 *
 * Deliberately understated: these are context, not conversation. Previously
 * each rendered as a bold pill with a generic info icon AND a chevron, which
 * gave a run of them the look of a settings list rather than a chat, and long
 * server text turned the pill into a full-width grey block. The chevron in
 * particular appeared on every row, so it signalled nothing.
 */
export function SystemRow({ icon, text, tone = "neutral", onPress }: Readonly<SystemRowProps>) {
  // `subtleText` (#3A3548), not `mutedText` (#14121C) — the latter is near-black
  // and would make these asides heavier than the messages around them.
  const toneColor =
    tone === "good" ? colors.safe : tone === "bad" ? colors.danger : colors.subtleText;

  const body = (
    <View style={styles.systemPill}>
      {/* Icon only where it carries meaning — a neutral update needs no glyph. */}
      {tone !== "neutral" ? (
        <Ionicons name={icon} size={12} color={toneColor} style={styles.systemIcon} />
      ) : null}
      <Text style={[styles.systemPillText, { color: toneColor }]}>{text}</Text>
    </View>
  );

  return (
    <View style={styles.systemRow}>
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={text}>
          {body}
        </Pressable>
      ) : (
        body
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  systemRow: {
    alignItems: "center",
    justifyContent: "center",
    // Generous side padding keeps a long status from spanning the full width,
    // so it reads as a centered aside rather than another message.
    paddingHorizontal: 44,
    marginVertical: 6,
  },
  systemPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    // Translucent rather than a solid fill: these sit between bubbles and
    // shouldn't compete with them for weight.
    backgroundColor: "rgba(8, 7, 13, 0.05)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  systemIcon: { marginTop: 1 },
  systemPillText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    textAlign: "center",
    // Lets a long status wrap inside the pill instead of forcing it wider.
    flexShrink: 1,
  },
});

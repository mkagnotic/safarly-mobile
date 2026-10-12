import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";

import { KeyboardLift } from "@/components/ui/KeyboardLift";
import { colors } from "@/theme/colors";
import { sharedStyles } from "@/features/bookings/bookingsStyles";

// ─────────────── Keyboard-safe modal frame ───────────────

/**
 * Backdrop + centered card for the modals below that take typed input. A
 * Modal's window is not resized for the keyboard on either platform (Android
 * Modals are edge-to-edge), so the card is lifted with `KeyboardLift` and
 * scrolls once it no longer fits — otherwise an autoFocused multiline reason
 * hides the footer buttons.
 * `keyboardShouldPersistTaps="handled"` lets a tap outside the input dismiss
 * the keyboard, which a multiline input has no return key to do.
 */
export function KeyboardModalCard({
  onBackdropPress,
  children,
}: Readonly<{ onBackdropPress: () => void; children: ReactNode }>) {
  return (
    <KeyboardLift style={styles.flex}>
      <Pressable style={sharedStyles.modalBackdrop} onPress={onBackdropPress} />
      <View style={[sharedStyles.modalCenter, styles.modalCenterKeyboard]} pointerEvents="box-none">
        <ScrollView
          style={styles.modalCardScroll}
          contentContainerStyle={styles.modalCardScrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {children}
        </ScrollView>
      </View>
    </KeyboardLift>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Keeps a keyboard-lifted card clear of the status bar.
  modalCenterKeyboard: { paddingVertical: 24 },
  modalCardScroll: {
    width: "100%",
    maxWidth: 440,
    flexGrow: 0,
    borderRadius: 18,
    backgroundColor: colors.card,
  },
  modalCardScrollContent: { padding: 18, gap: 12 },
});

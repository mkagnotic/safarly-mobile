import { Ionicons } from "@expo/vector-icons";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton } from "@/components/ui/AppButton";
import { colors, screenCanvas } from "@/theme/colors";

/**
 * The one screen a build shows when it is too old to be trusted.
 *
 * Deliberately NOT dismissible, and deliberately rendered ABOVE the navigator
 * in App.tsx — not as a route. A route can be deep-linked past, and a banner
 * can be ignored; neither is any use when the reason for the gate is that the
 * old client gets something WRONG rather than merely missing a feature. The
 * case that motivated this: a build whose Google sign-in skipped the account
 * picker, so a second person on a shared phone landed in the first person's
 * account. No server change can fix that, and nothing could make the affected
 * install update.
 *
 * It has one action. There is no "later", because there is nothing safe to do
 * in the meantime.
 */

const STORE_URL = Platform.select({
  android: "https://play.google.com/store/apps/details?id=com.mysafarly.app",
  ios: "https://apps.apple.com/app/safarly/id0000000000",
  default: "https://mysafarly.com",
}) as string;

type Props = {
  /** Shown as the reason. Server-supplied so it can describe the ACTUAL fix. */
  message?: string;
  /** Overrides the store link, for the rare case the server knows better. */
  storeUrl?: string;
};

export function UpdateRequiredScreen({ message, storeUrl }: Props) {
  const open = () => {
    void Linking.openURL(storeUrl || STORE_URL);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>
        <View style={styles.card}>
          <View style={styles.iconRing}>
            <Ionicons name="arrow-up-circle" size={44} color={colors.primary} />
          </View>

          <Text style={styles.title}>Update Safarly to continue</Text>

          <Text style={styles.body}>
            {message ||
              "This version is out of date and some things no longer work correctly. Update to the latest version to keep using Safarly."}
          </Text>

          <AppButton label="Update now" onPress={open} />

          <Text style={styles.footnote}>
            You will be taken to {Platform.OS === "ios" ? "the App Store" : "Google Play"}.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: screenCanvas },
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    // Matches the elevation the rest of the app uses for primary surfaces.
    shadowColor: "#2D1550",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.mutedText,
    textAlign: "center",
    marginBottom: 24,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.subtleText,
    textAlign: "center",
    marginTop: 14,
  },
});

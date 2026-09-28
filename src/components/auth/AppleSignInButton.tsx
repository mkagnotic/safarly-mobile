// Sign in with Apple button.
//
// This renders Apple's own `AppleAuthenticationButton` rather than a look-alike.
// Guideline 4.8 and the Sign in with Apple HIG both constrain the button's
// wording, logo, colour and corner radius, and the system component is the only
// thing guaranteed to stay compliant as iOS changes — a hand-rolled black button
// is a recurring review rejection.
//
// The module is required lazily for the same reason as `appleOAuth.ts`: a
// top-level import of an iOS-only native module throws at evaluation time on
// Android, which would take the auth screen down on the platform that has no
// Apple button at all.

import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { isAppleSignInAvailable } from "@/services/auth/appleOAuth";

/** Matches `AppButton`'s `base.borderRadius` so the auth CTAs line up. */
const CORNER_RADIUS = 16;
/** paddingVertical 14 + ~20pt line box, i.e. the height AppButton settles at. */
const BUTTON_HEIGHT = 52;

interface Props {
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppleSignInButton({ onPress, disabled, busy, style }: Readonly<Props>) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    isAppleSignInAvailable().then((ok) => {
      if (active) setAvailable(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!available) return null;

  // Safe: `available` is only ever true on iOS with the native module present.
  const AppleAuthentication = require("expo-apple-authentication") as
    typeof import("expo-apple-authentication");

  return (
    <View style={[styles.wrap, style]}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={CORNER_RADIUS}
        style={styles.button}
        onPress={disabled || busy ? () => {} : onPress}
      />
      {busy ? (
        // Apple's button takes no busy state, so cover it while the handshake
        // runs. This also swallows repeat taps.
        <View style={styles.busyOverlay} pointerEvents="auto">
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch" },
  button: { width: "100%", height: BUTTON_HEIGHT },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    borderRadius: CORNER_RADIUS,
  },
});

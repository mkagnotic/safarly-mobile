import { Ionicons } from "@expo/vector-icons";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton } from "@/components/ui/AppButton";
import { reportError } from "@/lib/errorReporter";
import { colors, screenCanvas } from "@/theme/colors";

/**
 * Catches a render crash anywhere under the navigator, reports it to
 * Admin → Errors, and shows a way back instead of a blank screen.
 *
 * Without it a render error in a release build unmounted the whole tree: the
 * user saw an empty screen and nothing reached us. "Try again" remounts the
 * navigator, which is how the user would otherwise recover (by killing the app).
 * Styled like UpdateRequiredScreen, the app's other full-screen state.
 */
type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError({
      // user-facing-ok: sent to error monitoring (Admin → Errors), never rendered.
      message: error?.message || String(error),
      stack: [error?.stack, info.componentStack].filter(Boolean).join("\n--- component stack ---"),
    });
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.root}>
          <View style={styles.card}>
            <View style={styles.iconRing}>
              <Ionicons name="alert-circle" size={44} color={colors.primary} />
            </View>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.body}>
              This screen ran into a problem. Our team has been notified. Try again to continue.
            </Text>
            <AppButton label="Try again" onPress={this.reset} />
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: screenCanvas },
  root: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
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
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700", color: colors.text, textAlign: "center", marginBottom: 10 },
  body: { fontSize: 15, lineHeight: 22, color: colors.mutedText, textAlign: "center", marginBottom: 24 },
});

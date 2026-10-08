import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { UpdateRequiredScreen } from "@/components/UpdateRequiredScreen";
import { AppFeedbackProvider } from "@/context/AppFeedbackContext";
import { AuthProvider } from "@/context/AuthContext";
import { useVersionGate } from "@/hooks/useVersionGate";
import { linking } from "@/navigation/linking";
import { navigationRef } from "@/navigation/navigationRef";
import { RootNavigator } from "@/navigation/RootNavigator";
import { colors, screenCanvas } from "@/theme/colors";

const appTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    /** Matches page canvas so default nav surfaces aren’t a different white */
    background: screenCanvas,
    card: colors.card,
    text: colors.text,
    primary: colors.primary,
    border: colors.border,
  },
};

export default function App() {
  /**
   * The force-update gate sits ABOVE the navigator, not inside it.
   *
   * A route can be reached around — a deep link, a restored navigation state,
   * a push notification tap. Returning early here means a build below the
   * server's floor renders exactly one thing and nothing else mounts: no auth,
   * no data fetching, no navigation. That matters because the gate's job is to
   * stop a client that gets something WRONG, not one that is merely behind.
   *
   * It is false until proven otherwise, so a healthy launch is unaffected and
   * nothing waits on the network. See `useVersionGate`.
   */
  const gate = useVersionGate();

  if (gate.blocked) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: screenCanvas }}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <UpdateRequiredScreen message={gate.message} storeUrl={gate.storeUrl} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: screenCanvas }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppFeedbackProvider>
            <NavigationContainer ref={navigationRef} theme={appTheme} linking={linking}>
              <StatusBar style="dark" />
              <RootNavigator />
            </NavigationContainer>
          </AppFeedbackProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

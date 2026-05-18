import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppFeedbackProvider } from "@/context/AppFeedbackContext";
import { AuthProvider } from "@/context/AuthContext";
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
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: screenCanvas }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppFeedbackProvider>
            <NavigationContainer theme={appTheme}>
              <StatusBar style="dark" />
              <RootNavigator />
            </NavigationContainer>
          </AppFeedbackProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

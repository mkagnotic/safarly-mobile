import { createNavigationContainerRef } from "@react-navigation/native";

import { RootStackParamList } from "@/navigation/types";

/**
 * App-wide navigation ref, attached to the root `NavigationContainer` in
 * `App.tsx`. Lets non-React code — specifically the push-notification response
 * handler, which fires outside the component tree — drive navigation when the
 * user taps a notification. Screen components should keep using `useNavigation`.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

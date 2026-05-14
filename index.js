import "react-native-gesture-handler";
import { enableFreeze, enableScreens } from "react-native-screens";

enableScreens(true);
/** Off-screen tab routes skip re-renders (native); no-op on web. */
enableFreeze(true);

import "./src/theme/applyDefaultTypography";
import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);

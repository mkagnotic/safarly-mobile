// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Zustand's ESM files use `import.meta`, which Metro's web output cannot run as a classic bundle script.
// Prefer the same `react-native` export condition as iOS/Android (CJS + process.env) — valid for react-native-web.
config.resolver = {
  ...config.resolver,
  unstable_conditionsByPlatform: {
    ...config.resolver.unstable_conditionsByPlatform,
    web: ["react-native", "browser"],
  },
};

module.exports = config;

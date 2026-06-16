const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

module.exports = [
  // Test files run under Node's built-in test runner, not the RN/TS app toolchain.
  { ignores: ["node_modules/**", "**/*.test.ts", "**/*.test.tsx"] },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["node_modules/**"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "no-console": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];

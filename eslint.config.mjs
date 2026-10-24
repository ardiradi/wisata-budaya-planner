import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ["*.{ts,mjs}", "scripts/**/*.mjs", "tests/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "experiments/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

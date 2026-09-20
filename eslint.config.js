import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "screenshots/**"],
  },
  js.configs.recommended,
  {
    // Node tooling scripts (release / changelog automation).
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2022,
      globals: { ...globals.node },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}", "*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        sourceType: "module",
        ecmaVersion: 2022,
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      import: importPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    settings: {
      // Preact's hooks live in `preact/hooks`; the plugin only needs the
      // names, which are the React ones.
      react: { version: "18" },
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // TypeScript checks for undefined identifiers itself; the core rule
      // only produces false positives for DOM/Web globals.
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "no-useless-assignment": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // `src/domain/` is pure: no imports from ui/, platform/, net/, app/, no
    // DOM, no fetch. Everything about *what* an install is (the plan, the
    // generated configs, the sizes) lives here and is unit-tested without a
    // browser.
    files: ["src/domain/**/*.ts"],
    plugins: { import: importPlugin },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "src/domain",
              from: "src/ui",
              message: "domain/ must not import from ui/",
            },
            {
              target: "src/domain",
              from: "src/app",
              message: "domain/ must not import from app/",
            },
            {
              target: "src/domain",
              from: "src/net",
              message: "domain/ must not import from net/",
            },
            {
              target: "src/domain",
              from: "src/platform",
              message: "domain/ must not import from platform/",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "window", message: "domain/ must not touch the DOM" },
        { name: "document", message: "domain/ must not touch the DOM" },
        { name: "fetch", message: "domain/ must not perform I/O" },
        { name: "navigator", message: "domain/ must not sniff the browser" },
      ],
    },
  },
];

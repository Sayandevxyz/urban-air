// ============================================================================
// eslint.config.mjs
// Enforces uniform strict ESLint, complexity, file size, and security rules.
// ============================================================================

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import security from "eslint-plugin-security";
import tseslint from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  ...tseslint.configs.strictTypeChecked,
  security.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": true,
          "ts-expect-error": true,
          "ts-nocheck": true,
        },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true, allowBoolean: true },
      ],
      "no-console": "error",
      "max-lines-per-function": ["error", { max: 45, skipBlankLines: true, skipComments: true }],
      complexity: ["error", 10],
      "max-depth": ["error", 3],
      "max-params": ["error", 4],
      "max-lines": ["error", 200],
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "never",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/no-noninteractive-tabindex": ["error", { roles: ["tabpanel", "region"] }],
      "security/detect-object-injection": "off",
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "no-magic-numbers": [
        "error",
        { ignore: [0, 1, -1, 2, 100], ignoreArrayIndexes: true, enforceConst: true },
      ],
    },
  },
  {
    files: [
      "eslint.config.mjs",
      "postcss.config.mjs",
      "next.config.ts",
      "tailwind.config.ts",
      "vitest.config.ts",
      "playwright.config.ts",
      "scripts/check-structure.mjs",
    ],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      "security/detect-non-literal-fs-filename": "off",
    },
  },
);

export default eslintConfig;

import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    testTimeout: 15_000,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/domain/types.ts",
        "src/services/providers.ts",
        "src/app/layout.tsx",
        "src/app/**/loading.tsx",
        "src/i18n/messages/*.json",
      ],
      thresholds: {
        lines: 97,
        branches: 95,
        functions: 97,
        statements: 97,
        "src/domain/**/*.ts": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        "src/lib/**/*.ts": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
      },
    },
  },
});

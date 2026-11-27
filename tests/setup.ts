// ============================================================================
// tests/setup.ts
// Configures Vitest DOM matchers, jest-axe assertions, and automatic cleanup.
// ============================================================================

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "jest-axe";
import { afterEach, expect } from "vitest";

declare module "vitest" {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
    toHaveNoViolations(): T extends symbol ? R : R;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}

expect.extend(matchers.toHaveNoViolations);

afterEach(() => {
  cleanup();
});

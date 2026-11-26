import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "jest-axe";
import { afterEach, expect } from "vitest";

expect.extend(matchers.toHaveNoViolations);

afterEach(() => {
  cleanup();
});

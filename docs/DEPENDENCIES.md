# Dependencies Justification

Every production and development dependency is intentionally minimal, audited with `npm audit --audit-level=high`, and pinned in `package-lock.json`.

## Production Dependencies (5 total)

| Package                        | Purpose                                                                       | Justification & Alternatives Considered                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `next` (`15.x`)                | Full-stack React framework (App Router, RSC, API Routes, Middleware)          | Required by project specification; provides server-side LLM/upstream proxying, dynamic code-splitting, and CSP middleware.         |
| `react` & `react-dom` (`19.x`) | Core UI rendering library                                                     | Required peer dependencies of Next.js 15.                                                                                          |
| `zod`                          | Runtime schema validation for env, API boundaries, and upstream responses     | Prevents invalid inputs, enforces type safety at runtime, and guarantees safe error responses without unvalidated type assertions. |
| `next-intl`                    | Typed internationalization for English (`en`), Hindi (`hi`), and Tamil (`ta`) | Provides clean catalog-based i18n formatting with zero hardcoded UI strings and minimal runtime overhead.                          |

> **Deliberately Omitted Heavy Packages**:
>
> - **Charts (`recharts` / `chart.js`)**: Excluded (~120+ kB gzip) in favor of custom zero-dependency accessible SVG charts (`role="img"`, patterns, keyboard/table synchronization) keeping first-load JS well under the 150 kB gzip budget.
> - **Icon libraries (`lucide-react`)**: Excluded in favor of lightweight, tree-shaken inline accessible SVG icon components in `src/components/icons/`.
> - **LLM SDKs (`@google/genai`, `@anthropic-ai/sdk`)**: Excluded from runtime dependencies in favor of hardened native `fetch` through the server-side SSRF-allowlisted HTTP client (`src/services/http.ts`), saving ~2+ MB of transitive dependencies and simplifying timeout/size-limit enforcement.

## Development & Verification Dependencies

| Package                                                                                                                         | Purpose                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `typescript`, `@types/*`                                                                                                        | Strict compile-time type checking (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).                  |
| `tailwindcss`, `postcss`, `autoprefixer`                                                                                        | Utility-first CSS purged at build time for minimal CSS payload.                                                          |
| `eslint`, `eslint-config-next`, `typescript-eslint`, `eslint-plugin-jsx-a11y`, `eslint-plugin-security`, `eslint-plugin-import` | Zero-warning static analysis covering TypeScript strictness, accessibility, security anti-patterns, and import ordering. |
| `prettier`                                                                                                                      | Deterministic code formatting.                                                                                           |
| `vitest`, `@vitest/coverage-v8`, `@vitejs/plugin-react`, `jsdom`                                                                | Fast deterministic unit/component test runner with enforced coverage thresholds.                                         |
| `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`                                            | User-centric accessible component tests.                                                                                 |
| `msw`                                                                                                                           | Network-level mocking for deterministic API route and integration tests.                                                 |
| `jest-axe`, `axe-core`, `@types/jest-axe`                                                                                       | Automated WCAG accessibility checks inside component tests.                                                              |
| `@playwright/test`, `@axe-core/playwright`                                                                                      | Real Chromium E2E flows (desktop + mobile + keyboard-only) and page-level axe audits.                                    |
| `@next/bundle-analyzer`, `cross-env`                                                                                            | Build bundle budget inspection (`npm run analyze`) and cross-OS script execution.                                        |

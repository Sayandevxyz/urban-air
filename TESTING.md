# Testing

Evaluation criterion: Testing — comprehensive unit, integration, contract, accessibility, and E2E verification.

## 1. Four-Tier Testing Pyramid

- **Pure Domain, Security, Lib & Hook Unit Tests (`tests/unit/`)**: `domain-aqi-charts.test.ts`, `domain-guidance.test.ts`, `domain-planner-alerts.test.ts`, `domain-routines-impact.test.ts`, `domain-properties.test.ts`, `assistant-security.test.ts`, `open-meteo-cache.test.ts`, `security-rate-limit.test.ts`, `services-edge.test.ts`, `lib-core.test.ts`, `hooks-air-quality.test.tsx`, `hooks-secondary.test.tsx`.
- **MSW Route Integration Tests (`tests/integration/`)**: `api-routes.test.ts` and `chat-route.test.ts` exercising Zod query/body validation, `415` JSON type guards, `413` pre-read body caps, `429` + `Retry-After` rate limiting, upstream error mapping, and zero-key / LLM prompt-injection refusal.
- **Accessible Component Suites (`tests/components/`)**: `city-search-alerts.test.tsx`, `dashboard-forecast-guidance.test.tsx`, and `compare-chat-workbench.test.tsx` testing user flows with React Testing Library plus automated `jest-axe` assertions (`0` violations).
- **Playwright Browser E2E & WCAG 2.2 (`tests/e2e/urban-air.spec.ts`)**: Runs on Desktop (`chromium-desktop`) and Mobile (`chromium-mobile`) verifying CSP/security headers, `0` console errors, keyboard navigation, language reload persistence, offline cache / `429` handling, `320 px` reflow, and light/dark `@axe-core/playwright` scans.

## 2. Measured Coverage Gates (`vitest.config.ts`)

`npm run test:coverage` passes **17 test files, 124/124 tests** (`0` skipped, `0` `.only`) against hard V8 thresholds:

| Scope                  | Threshold (Stmts / Branch / Func / Line) | Measured (V8)                     |
| ---------------------- | ---------------------------------------- | --------------------------------- |
| Global (`src/**`)      | `97% / 95% / 97% / 97%`                  | `99.39% / 95.24% / 100% / 99.59%` |
| `src/domain/**/*.ts`   | `100% / 100% / 100% / 100%`              | `100% / 100% / 100% / 100%`       |
| `src/lib/**/*.ts`      | `100% / 100% / 100% / 100%`              | `100% / 100% / 100% / 100%`       |
| `src/components/*.tsx` | Covered in global gate                   | `99.75% / 93.72% / 100% / 99.73%` |
| `src/services/*.ts`    | Covered in global gate                   | `99.46% / 93.80% / 100% / 99.80%` |
| `src/hooks/*.ts`       | Covered in global gate                   | `97.71% / 91.26% / 100% / 98.21%` |

## 3. Property Fuzzing, Contract Checks, Repeatability & Mutation

- **Property Fuzzing (`tests/unit/domain-properties.test.ts`)**: `fast-check` verifies monotonic EPA category transitions across `0..500`, `O(n)` planner bounds (`0..100`), finite exposure/emissions math, and alert inequalities.
- **Upstream Contract (`tests/unit/open-meteo-cache.test.ts`)**: Validates Open-Meteo geocoding & air-quality payloads, clamping, sparse hours, and cache SWR/dedupe invariants.
- **CI Repeatability (`.github/workflows/ci.yml`)**: Executes `npm run test` three times consecutively in CI (`for i in 1 2 3`) to reject flaky timers or mutable state leaks.
- **Mutation Testing Record**: Baseline `Stryker` evaluation across `src/domain/*.ts` achieved `87.85%` mutation score (`651/741` killed, `0` uncovered). Commands: `npm run test:coverage` and `npm run test:e2e`.

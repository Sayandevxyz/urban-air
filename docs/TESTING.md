# Testing Strategy & Quality Gates

## Testing Pyramid

Urban Air Quality Assistant uses a four-tier verification pyramid built with Vitest, `fast-check`, React Testing Library, `jest-axe`, MSW, and Playwright + `@axe-core/playwright`.

| Layer                                      | Runner & Libraries                  | Scope & Suite Files                                                                                                                                                                                                                                                                                   | Count             |
| ------------------------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **Pure Domain, Security & Lib Unit Tests** | Vitest + `fast-check`               | `tests/unit/domain-*.test.ts`, `domain-properties.test.ts`, `open-meteo-contract.test.ts`, `assistant-security.test.ts`, `env.test.ts`, `errors.test.ts`, `cache.test.ts`, `rate-limit.test.ts`, `security-http.test.ts`, `logger.test.ts`, `i18n.test.ts`, `services-edge.test.ts`, `hooks.test.tsx` | 18 files          |
| **API & Upstream Contract Integration**    | Vitest + Zod + MSW                  | `tests/integration/api-routes.test.ts`, `tests/integration/chat-route.test.ts`                                                                                                                                                                                                                        | 2 files           |
| **Accessible Component Suites**            | Vitest + RTL + `jest-axe`           | `tests/components/dashboard-and-forecast.test.tsx`, `guidance-routines-planner.test.tsx`, `search-compare-alerts-chat.test.tsx`                                                                                                                                                                       | 3 files           |
| **End-to-End Browser & WCAG Suites**       | Playwright + `@axe-core/playwright` | `tests/e2e/urban-air.spec.ts`, `tests/e2e/a11y.spec.ts` (Desktop Chromium + Mobile Chromium)                                                                                                                                                                                                          | 2 files (6 specs) |

**Measured Suite Totals (Vitest + Playwright):**

- **Vitest**: `23` test files, `96` tests passing, zero skipped tests.
- **Playwright E2E**: `6` tests passing across `chromium-desktop` and `chromium-mobile` (including zero console errors, zero `securitypolicyviolation` CSP events, light/dark `@axe-core/playwright` scans, offline cached fallback, full-reload locale persistence, and HTTP `429` retry banner handling).

---

## Enforced Coverage Thresholds (`vitest.config.ts`)

`npm run test:coverage` enforces hard minimum coverage gates via V8 instrumentation:

| Scope                    | Statements | Branches | Functions | Lines    | Measured Result                       |
| ------------------------ | ---------- | -------- | --------- | -------- | ------------------------------------- |
| **Global (`src/**`)**    | **97%**    | **95%**  | **97%**   | **97%**  | **99.26% / 95.15% / 99.75% / 99.35%** |
| **`src/domain/**/*.ts`** | **100%**   | **100%** | **100%**  | **100%** | **100% / 100% / 100% / 100%**         |
| **`src/lib/**/*.ts`**    | **100%**   | **100%** | **100%**  | **100%** | **100% / 100% / 100% / 100%**         |
| `src/i18n/**`            | —          | —        | —         | —        | 100% / 100% / 100% / 100%             |
| `src/app/**`             | —          | —        | —         | —        | 100% / 100% / 100% / 100%             |
| `src/services/**`        | —          | —        | —         | —        | 99.47% / 94.18% / 100% / 99.44%       |
| `src/components/**`      | —          | —        | —         | —        | 98.71% / 92.30% / 99.24% / 98.63%     |
| `src/hooks/**`           | —          | —        | —         | —        | 98.44% / 94.08% / 100% / 98.96%       |

---

## Advanced Test Techniques

### 1. Property-Based Fuzzing (`fast-check`)

`tests/unit/domain-properties.test.ts` fuzzes pure calculations across randomized pollutant concentrations, AQI readings, personas, and commute parameters:

- Monotonic US AQI category transitions across `0..500`.
- Non-negative, finite activity planner scores clamped to `0..100` under arbitrary hourly forecasts.
- Deterministic emission savings and zero `NaN`/`Infinity` outputs for daily routines & impact math.
- Strict alert-rule comparison invariants (`>` vs `>=` semantics and cooldown windows).

### 2. Upstream Contract Verification

`tests/unit/open-meteo-contract.test.ts` validates real-shape Open-Meteo Geocoding and Air Quality JSON fixtures against `src/services/schemas.ts` and `src/services/openMeteoMapper.ts`, verifying sparse hourly gaps, clamping, missing optional fields, and European/US AQI fallback estimation.

### 3. CI Repeatability Gate

`.github/workflows/ci.yml` executes the full Vitest suite three consecutive times (`for i in 1 2 3; do npm run test; done`) to catch flaky timers, shared mutable state, or non-deterministic React effects.

---

## Mutation Testing (`Stryker` on `src/domain/*.ts`)

Pure domain logic was evaluated in an isolated temporary workspace with Stryker Mutator + `@stryker-mutator/vitest-runner`:

| Domain File                           | Mutation Score | Killed  | Survived | No Cov / Error |
| ------------------------------------- | -------------- | ------- | -------- | -------------- |
| `src/domain/alerts.ts`                | **100.00%**    | 21      | 0        | 0              |
| `src/domain/forecastChartGeometry.ts` | **98.57%**     | 69      | 1        | 0              |
| `src/domain/planner.ts`               | **97.56%**     | 80      | 2        | 0              |
| `src/domain/aqi.ts`                   | **91.23%**     | 156     | 15       | 0              |
| `src/domain/routines.ts`              | **85.94%**     | 55      | 9        | 0              |
| `src/domain/impact.ts`                | **84.00%**     | 63      | 12       | 0              |
| `src/domain/guidance.ts`              | **81.66%**     | 138     | 31       | 0              |
| `src/domain/aqiBreakpoints.ts`        | **77.53%**     | 69      | 20       | 0              |
| **Total (`src/domain/*.ts`)**         | **87.85%**     | **651** | **90**   | **0**          |

> All `741` generated mutants across `src/domain/*.ts` were covered by tests (`0` uncovered mutants, `0` timeout/runtime errors).

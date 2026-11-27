# Code Quality

Evaluation criterion: Code Quality — clean structure, modularity, readability, minimal technical debt.

## 1. Layered Architecture & Responsibility Boundaries

- **`src/domain/` (`8` pure modules)**: Zero framework, DOM, network, or env dependencies. Houses EPA/EAQI breakpoints (`src/domain/aqi-breakpoints.ts`), smog detection (`src/domain/aqi.ts`), chart SVG scaling (`src/domain/forecast-geometry.ts`), persona guidance & indoor hacks (`src/domain/guidance.ts`), $O(n)$ window planner (`src/domain/planner.ts`), daily routines (`src/domain/routines.ts`), exposure/CO2 math (`src/domain/impact.ts`), and threshold alerts (`src/domain/alerts.ts`).
- **`src/services/` (`13` modules)**: Provider abstractions (`src/services/open-meteo.ts`, `src/services/open-meteo-mapper.ts`), bounded SWR LRU cache & dedupe (`src/services/cache.ts`), token-bucket & daily quotas (`src/services/rate-limit.ts`), SSRF-guarded fetch (`src/services/http.ts`), CSP/security headers (`src/services/security.ts`), Zod schemas (`src/services/schemas.ts`), route guards (`src/services/route-helpers.ts`), DI container (`src/services/container.ts`), and LLM pipeline (`src/services/assistant.ts`, `src/services/assistant-responses.ts`, `src/services/assistant-sanitize.ts`, `src/services/demo-data.ts`).
- **`src/lib/` (`5` modules)**: Named constants (`src/lib/constants.ts`), Zod env validation (`src/lib/env.ts`), `AppError`, `Result<T, E>`, and typed JSON narrowers (`src/lib/errors.ts`), client API validation (`src/lib/api-client.ts`), and redacted structured logger (`src/lib/logger.ts`).
- **`src/hooks/` (`7`), `src/components/` (`17`), `src/types/` (`3`), `src/app/` (`8`), `src/i18n/` (`3`)**: Focused React hooks (`useAirQualityData`, `useAsyncResource`, `useCitySearch`, `useCityComparison`, `useLocalAlerts`, `useRoutineInputs`, `useChat`), accessible UI sections sharing `src/components/UiPrimitives.tsx`, and trilingual catalogs (`en`, `hi`, `ta`).

## 2. Uniform Structural Guardrails (Zero Overrides)

`eslint.config.mjs` enforces uniform limits across every `.ts` and `.tsx` file with **zero size or complexity overrides**:

- `max-lines`: `200` (skip blank lines/comments; see ADR-01 in `docs/DECISIONS.md`)
- `max-lines-per-function`: `45`, `complexity`: `10`, `max-depth`: `3`, `max-params`: `4`
- `@typescript-eslint/no-explicit-any`: error, `no-magic-numbers` on `src/**` (ignoring `0, 1, -1`), `jsx-a11y`, `security`, `import/order`
- `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- `scripts/check-structure.mjs`: verifies kebab-case file naming across core layers, standard 4-line file header banners, one-line JSDoc on every exported `src/` symbol, zero `eslint-disable`/`@ts-*`/coverage-ignore, zero non-`const` `as` type casts in `src/`, and documentation constraints.

## 3. Command-Backed Before / After Evidence

| Metric                               | Baseline (`attempt-2-97.4`)    | Current (`quality-final`)                       |
| ------------------------------------ | ------------------------------ | ----------------------------------------------- |
| Tracked files (`git ls-files`)       | `148`                          | `118` (`-20.3%`)                                |
| `src/` `.ts`/`.tsx` modules          | `80`                           | `60` (`-25.0%`)                                 |
| Max `src/` file lines                | `244` (`src/services/http.ts`) | `200` (`eslint.config.mjs` enforced)            |
| Max `src/` function lines            | `82`                           | `<= 45` code lines (`eslint.config.mjs`)        |
| Non-`const` type assertions (`src/`) | Unchecked                      | `0` (verified by `scripts/check-structure.mjs`) |
| `npx jscpd src --threshold 3`        | `0.19%` lines                  | `0` exact clones (`0.00%` duplicated lines)     |
| `npx knip` unused files/deps/exports | `0`                            | `0` (`npm audit` = `0` vulnerabilities)         |
| Documentation files / footprint      | `11` docs / `86.7 KB`          | Consolidated 6 pillar docs + 3 `docs/` files    |

Verification command: `npm run verify && bash scripts/audit.sh` (`eslint . --max-warnings=0`, `tsc --noEmit`, `prettier --check .`, `node scripts/check-structure.mjs`, `knip`, `jscpd` all pass with exit code `0`).

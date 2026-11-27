# Refactor & Quality Engineering Plan

## 1. Objective

Raise automated and human-review **Code Quality** from baseline `89/100` (`attempt-2-97.4`) to `>= 98/100` while maintaining `100/100` across Security, Efficiency, Testing, Accessibility, and Problem Statement Alignment without changing user-visible behavior, DOM structure, ARIA semantics, or copy.

## 2. Phase Breakdown

| Phase | Scope                                                                  | Outcome & Verification                                                                          |
| ----- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **0** | Baseline tag `attempt-2-97.4`, cold rubric review, exact file/LOC log  | Recorded `148` tracked files, `80` `src/` modules, max `244`L/file and `82`L/fn.                |
| **1** | Consolidate trivial micro-modules (`useGeolocation`, security, mapper) | Consolidated fragmented hooks/services (`63f66e0`, `4c12e89`), eliminated redundant layers.     |
| **2** | Uniform ESLint (`200`/`45`/`10`), kebab naming, banners, WHY JSDoc     | Enforced zero ESLint overrides, `no-magic-numbers`, `scripts/check-structure.mjs`, `0%` jscpd.  |
| **3** | Remove untyped `as` casts, extract `UiPrimitives`, simplify effects    | Replaced all non-`const` `as` casts (`src/lib/errors.ts`), folded 2 tiny forms (`b7aefc4`).     |
| **4** | 6 root pillar docs, ADRs, pre-commit, file count `<= 118` (-20%)       | Consolidated `11` docs -> `6` concise pillar docs + `DECISIONS/PLAN/REQUIREMENTS`; `118` files. |
| **5** | Hostile cold review rounds, Lighthouse re-check & clean-clone `npm ci` | Re-verified cold rubric, headless Lighthouse, and isolated clone `npm ci && verify && e2e`.     |

## 3. Quality Gates

Every phase must pass cleanly before commit:

1. `npm run verify` (`node scripts/check-structure.mjs`, `eslint . --max-warnings=0`, `tsc --noEmit`, `prettier --check .`, `vitest run --coverage`, `next build`, `npm audit --audit-level=high`)
2. `npm run test:e2e` (Chromium Desktop + Mobile E2E & WCAG 2.2 `axe-core` Light/Dark scans)
3. `bash scripts/audit.sh` (all 12 repository, bundle `< 150 kB`, duplication `< 3%`, live HTTP CSP/SSRF/injection, and traceability gates)

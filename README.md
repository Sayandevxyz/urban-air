# Urban Air Quality Assistant (Challenge 6)

[![CI Verify](https://github.com/Sayandevxyz/urban-air/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A zero-API-key Next.js 15 App Router web assistant helping families and communities navigate severe winter smog and urban air pollution through live dual AQI analytics, personalized 7-persona guidance, indoor air hacks, $O(n)$ activity window planning, low-emission routine impact modeling, and a grounded GenAI chat assistant.

## Core Capabilities

- **Search & Private Geolocation**: ARIA APG city autocomplete (`300 ms` debounce + cancellation) and browser geolocation with zero coordinate storage.
- **Dual AQI, Smog & Pollutants**: US AQI + EAQI with color + SVG icon + text label (never color alone), winter smog alerts, and WHO 2021 pollutant breakdown (`PM2.5`, `PM10`, `NO2`, `O3`, `SO2`, `CO`).
- **48h Forecast & 7-Day Trend**: Accessible SVG polyline/bar charts with toggleable semantic HTML `<table>` parity.
- **Family Guidance, Routines & Direct Impact**: 7 household personas, indoor air quality hacks (HEPA / DIY MERV-13 box fan / wet mopping / clean cooking), sustainable routines, and live `PM2.5` µg / `CO2e` / `NOx` savings.
- **Activity Planner, GenAI Chat, Compare, Alerts & i18n**: $O(n)$ Run/Cycle/Walk/Ventilate planner, grounded Gemini/Anthropic chat with zero-key fallback and disclaimer, 3-city compare, `localStorage` alerts, and runtime `en` / `hi` / `ta` switching.

## Architecture & Evaluation Documentation

Clean layering (`src/domain` pure -> `src/services` -> `src/app/api`, `src/hooks`, `src/components`, `src/lib`, `src/i18n`) governed by uniform ESLint (`200`L file / `45`L function / `10` complexity) and strict TypeScript:

- **Engineering Pillars**: [Code Quality](CODE_QUALITY.md) · [Testing](TESTING.md) · [Security](SECURITY.md) · [Efficiency](EFFICIENCY.md) · [Accessibility](ACCESSIBILITY.md) · [Problem Alignment](PROBLEM_ALIGNMENT.md)
- **Architecture & Planning**: [Requirements](docs/REQUIREMENTS.md) · [Decisions (ADRs)](docs/DECISIONS.md) · [Refactor Plan](docs/PLAN.md)

## Quick Start (< 5 Minutes, Zero API Keys)

```bash
git clone https://github.com/Sayandevxyz/urban-air.git
cd urban-air && npm ci && npm run dev
```

Open `http://localhost:3000`. Toggle **Demo mode** anytime for offline inspection (`Delhi`, `Coimbatore`, `Mumbai`, `London`, `Beijing`), or copy `.env.example` to `.env.local` and optionally add `GEMINI_API_KEY` or `ANTHROPIC_API_KEY`.

```bash
npm run verify      # Structure, ESLint, tsc, Prettier, Vitest coverage, Next build, npm audit
npm run test:e2e    # Desktop & Mobile Playwright + WCAG 2.2 axe-core audits
bash scripts/audit.sh
```

## Scripts & Key Environment Variables

- **Scripts**: `dev`, `build`, `start`, `analyze`, `lint`, `typecheck`, `format`, `format:check`, `test`, `test:coverage`, `test:e2e`, `audit:deps`, `verify`.
- **Env (`src/lib/env.ts`, `.env.example`)**: `NEXT_PUBLIC_DEFAULT_DEMO_MODE`, `OPEN_METEO_{AIR_QUALITY,GEOCODING}_BASE_URL`, `LLM_PROVIDER` (`auto|gemini|anthropic|fallback`), `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `RATE_LIMIT_{MAX_REQUESTS,WINDOW_MS}`, `DAILY_LLM_MAX_REQUESTS`, `TRUST_PROXY`, `LOG_LEVEL`.
- **API Routes (`/api/*`, `Cache-Control: no-store`)**: `/api/health`, `/api/geocode`, `/api/air-quality`, `/api/chat`.

## Requirements Traceability (`R1`–`R26`)

| ID      | Requirement                               | Implementation                                        | Verification                                                        |
| ------- | ----------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- |
| **R1**  | Autocomplete search & APG combobox        | `useCitySearch.ts`, `CitySearchCombobox.tsx`          | `hooks-secondary.test.tsx`, `urban-air.spec.ts`                     |
| **R2**  | Private geolocation & denial fallback     | `useAirQualityData.ts`, `CitySearchBar.tsx`           | `hooks-air-quality.test.tsx`, `city-search-alerts.test.tsx`         |
| **R3**  | US/EAQI dashboard + icon/color/text       | `aqi-breakpoints.ts`, `AqiVisuals.tsx`                | `domain-aqi-charts.test.ts`, `dashboard-forecast-guidance.test.tsx` |
| **R4**  | Winter smog & inversion alerts            | `src/domain/aqi.ts`, `AqiDashboard.tsx`               | `domain-aqi-charts.test.ts`                                         |
| **R5**  | Six-pollutant WHO 2021 breakdown          | `src/domain/aqi.ts`, `AqiDashboard.tsx`               | `domain-aqi-charts.test.ts`                                         |
| **R6**  | 48h/7d SVG charts + table toggle          | `forecast-geometry.ts`, `ForecastSection.tsx`         | `domain-aqi-charts.test.ts`, `urban-air.spec.ts`                    |
| **R7**  | 7-persona mask/window/activity guidance   | `src/domain/guidance.ts`, `GuidanceSection.tsx`       | `domain-guidance.test.ts`                                           |
| **R8**  | Contextual indoor air quality hacks       | `src/domain/guidance.ts`, `GuidanceSection.tsx`       | `domain-guidance.test.ts`                                           |
| **R9**  | Tailored low-emission daily routines      | `src/domain/routines.ts`, `RoutinesImpactSection.tsx` | `domain-routines-impact.test.ts`                                    |
| **R10** | Direct impact (`PM2.5`, `CO2e`, `NOx`)    | `src/domain/impact.ts`, `useRoutineInputs.ts`         | `domain-routines-impact.test.ts`, `domain-properties.test.ts`       |
| **R11** | $O(n)$ activity window planner            | `src/domain/planner.ts`, `ActivityPlanner.tsx`        | `domain-planner-alerts.test.ts`, `urban-air.spec.ts`                |
| **R12** | Grounded GenAI chat + fallback + notice   | `src/services/assistant.ts`, `AirQualityChat.tsx`     | `assistant-security.test.ts`, `chat-route.test.ts`                  |
| **R13** | Side-by-side 3-city comparison            | `useCityComparison.ts`, `CityCompareSection.tsx`      | `compare-chat-workbench.test.tsx`, `urban-air.spec.ts`              |
| **R14** | Local `localStorage` threshold alerts     | `src/domain/alerts.ts`, `ThresholdAlertsSection.tsx`  | `domain-planner-alerts.test.ts`, `city-search-alerts.test.tsx`      |
| **R15** | `en`/`hi`/`ta` i18n + `<html lang>`       | `LocaleContext.tsx`, `src/i18n/*.json`                | `lib-core.test.ts`, `urban-air.spec.ts`                             |
| **R16** | Offline cache, empty, error & 429 UI      | `api-client.ts`, `StatusBanner.tsx`                   | `hooks-air-quality.test.tsx`, `lib-core.test.ts`                    |
| **R17** | Provider interfaces & Demo presets        | `open-meteo.ts`, `demo-data.ts`, `types/api.ts`       | `open-meteo-cache.test.ts`, `api-routes.test.ts`                    |
| **R18** | Layered modularity & uniform lint caps    | `eslint.config.mjs`, `check-structure.mjs`            | `CODE_QUALITY.md`, `scripts/audit.sh`                               |
| **R19** | Zod + runtime guards, `AppError`/`Result` | `schemas.ts`, `route-helpers.ts`, `errors.ts`         | `lib-core.test.ts`, `api-routes.test.ts`                            |
| **R20** | Nonce CSP, COOP/CORP/HSTS & SSRF guard    | `middleware.ts`, `security.ts`, `http.ts`             | `security-rate-limit.test.ts`, `services-edge.test.ts`              |
| **R21** | Rate limits, `TRUST_PROXY` & log privacy  | `rate-limit.ts`, `container.ts`, `logger.ts`          | `security-rate-limit.test.ts`, `lib-core.test.ts`                   |
| **R22** | Prompt-injection & output sanitization    | `assistant-sanitize.ts`, `AirQualityChat.tsx`         | `assistant-security.test.ts`, `chat-route.test.ts`                  |
| **R23** | SWR cache, dynamic split, 139 kB budget   | `cache.ts`, `UrbanAirWorkbench.tsx`                   | `open-meteo-cache.test.ts`, `EFFICIENCY.md`                         |
| **R24** | WCAG 2.2 AA, 44 px targets, 0 axe issues  | `globals.css`, `UiPrimitives.tsx`                     | `ACCESSIBILITY.md`, `urban-air.spec.ts`                             |
| **R25** | 100% domain/lib coverage, fuzzing, E2E    | `vitest.config.ts`, `playwright.config.ts`            | `TESTING.md`, `domain-properties.test.ts`                           |
| **R26** | CI, pre-commit, secrets & 12-check gate   | `.pre-commit-config.yaml`, `scripts/audit.sh`         | `SECURITY.md`, `scripts/audit.sh`                                   |

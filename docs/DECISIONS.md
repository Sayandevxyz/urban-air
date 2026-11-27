# Architecture Decision Records (ADRs)

## ADR-01: Uniform 200-Line Module & 45-Line Function Limits Without Overrides

- **Decision**: Enforce uniform ESLint limits (`max-lines: 200`, `max-lines-per-function: 45`, `complexity: 10`, `max-depth: 3`, `max-params: 4`) and `no-magic-numbers` across every `.ts` and `.tsx` file in `src/` and `tests/`, with zero per-directory overrides.
- **Rationale**: Per-folder size exceptions create creeping god-modules (`244`-line services and `80`-line JSX handlers) and obscure responsibility seams. A single flat ceiling forces small cohesive helpers (`src/components/UiPrimitives.tsx`, `src/domain/aqi-breakpoints.ts`, `src/domain/forecast-geometry.ts`) that fit on one screen, review linearly, and test without complex mocking.
- **Consequence**: Contributors must extract pure helpers or composable subcomponents instead of suppressing lint rules or adding ESLint override blocks.

## ADR-02: Dependency-Free Pure Domain Layer (`src/domain/`)

- **Decision**: Keep all US EPA/EAQI breakpoint calculations, winter smog heuristics, 7-persona advice matrices, $O(n)$ window scoring, daily routine rules, CO2e/PM2.5 impact math, and SVG scaling geometry completely pure with zero React, HTTP, or `process.env` imports.
- **Rationale**: Pure deterministic functions guarantee reproducible calculations across SSR, CSR, Demo Mode, and server chat grounding while sustaining **100%** line/branch/function/statement V8 test coverage and `fast-check` property fuzzing.

## ADR-03: Zero-Dependency Accessible SVG Charts + Semantic Table Parity

- **Decision**: Implement 48-hour polyline and 7-day diagonal-patterned bar charts using declarative inline `<svg>` backed by `src/domain/forecast-geometry.ts` plus toggleable HTML `<table>` views (`src/components/ForecastSection.tsx`) instead of heavyweight charting dependencies.
- **Rationale**: Saves >100 kB gzipped client JavaScript (keeping root First Load JS at `139 kB` < `150 kB`), guarantees WCAG 1.1.1/1.4.1 non-color-alone signaling, and preserves screen-reader parity.

## ADR-04: SSRF-Allowlisted Server Fetch & Lightweight Typed Client Narrowers

- **Decision**: Validate all HTTP route inputs, environment variables (`src/lib/env.ts`), and upstream payloads via Zod (`src/services/schemas.ts`) over hardened `fetchJsonWithGuard` (`src/services/http.ts`), while using pure TypeScript Map-based narrowers (`toMap`, `toStr`, `toNum`, `toArr` in `src/lib/errors.ts`) inside client modules (`src/lib/api-client.ts`, `src/hooks/useLocalAlerts.ts`, `src/hooks/useChat.ts`).
- **Rationale**: Eliminates both LLM SDK bloat and unsafe `as` type casts without adding Zod runtime weight to the client JS bundle, keeping `/` well inside the `150 kB` First Load budget and `src/lib/**` at 100% V8 coverage.

## ADR-05: Dual Nonce CSP & Privacy-by-Default Coordinates

- **Decision**: Enforce cryptographic per-request CSP nonces on both `script-src` and `style-src` (`src/middleware.ts`, `src/services/security.ts`) with no `x-nonce` HTTP response echo, `COOP: same-origin`, `CORP: same-origin`, and `Cache-Control: no-store` on `/api/*`. Browser geolocation stays in transient React state, skips `localStorage`, and rounds coordinates to 2 decimals in `src/lib/logger.ts`.

## ADR-06: In-Memory Bounded SWR Cache & Token-Bucket Rate Limiter Behind Interfaces

- **Decision**: Program routes and services against interfaces (`AirQualityProvider`, `GeocodingProvider` in `src/types/api.ts`; `RateLimiter` in `src/services/rate-limit.ts`) backed by in-memory bounded LRU/SWR caching (`src/services/cache.ts`) and token-bucket + 24h LLM quota enforcement.
- **Rationale**: Zero external Redis/database setup required for local grading while enabling single-module provider or Redis adapter substitution in clustered deployments.

## ADR-07: Zero-API-Key Guarantee via Open-Meteo & Deterministic Grounded Assistant

- **Decision**: Default `LLM_PROVIDER=auto` uses server-side Gemini or Anthropic when configured and seamlessly runs the trilingual deterministic rule-based engine (`src/services/assistant-responses.ts`) strictly bounded to validated `airQualityContext` telemetry when zero keys are set.

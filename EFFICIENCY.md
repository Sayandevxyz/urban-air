# Efficiency

Evaluation criterion: Efficiency — lean JS/CSS bundles, bounded caching/dedupe, non-blocking loading, and algorithmic complexity.

## 1. Measured Bundle & Runtime Performance

- **First Load JS (`npm run build`)**: Root `/` loads in **`137 kB`** First Load JS (`13.4 kB` route + `103 kB` shared chunks), safely below the enforced **`< 150 kB`** gzip budget verified automatically by `scripts/audit.sh` Check 7.
- **Minimal Asset & Font Overhead**: `src/app/icon.svg` is an inline-served `< 1 kB` vector icon; `src/app/globals.css` uses the native system/Devanagari/Tamil font stack with zero external blocking font requests (`0` font requests).
- **Lighthouse Verification (`next start` + Demo Mode)**: Measured via 5 back-to-back alternating mobile runs and 3 desktop runs using System Chrome 13.6 (`--disable-features=CrossOriginOpenerPolicy` for CLI trace capture while production serves full `COOP: same-origin`):
  - **Desktop (3 runs)**: **`100` Performance** median (`min 100`, `max 100`, `TBT 38 ms`, `FCP 319 ms`, `LCP 319 ms`, `CLS 0`).
  - **Mobile (5 runs, 4x CPU throttle)**: **`90` Performance** median (`min 84`, `max 94`, `TBT 393 ms` median with runs down to `286 ms`, `FCP 1.1 s`, `LCP 1.1 s`, `CLS 0`).
- **Fair A/B Measurement vs Baseline (`attempt-2-97.4`)**:
  - Baseline: Mobile median **`85`** (`min 76`, `max 92`, `TBT 584 ms`), Desktop median **`100`** (`TBT 57 ms`).
  - Current (`quality-final`): Mobile median **`90`** (`min 84`, `max 94`, `TBT 393 ms`), Desktop median **`100`** (`TBT 38 ms`).

## 2. Implemented Optimizations

- **Below-the-Fold Splitting (`src/components/UrbanAirWorkbench.tsx`)**: Dynamically imports 7 lower sections (`ForecastSection`, `GuidanceSection`, `ActivityPlanner`, `RoutinesImpactSection`, `CityCompareSection`, `ThresholdAlertsSection`, `AirQualityChat`) with `{ ssr: true }`, keeping initial SSR complete while reducing hydration JS to `13.4 kB`.
- **Decoupled UI Tokens (`src/lib/constants.ts`)**: Extracted `TONE_SURFACE_CLASSES` from `src/components/UiPrimitives.tsx` to `src/lib/constants.ts` so eager components like `StatusBanner` do not pull the heavy `UiPrimitives` component tree into the critical bundle.
- **In-Memory Locale Cache & Preload (`src/components/LocaleContext.tsx`)**: Caches dynamic i18n JSON imports in a module-level `Map` and provides `preloadLocaleMessages`, making locale switching and testing deterministic.
- **Zero Heavy Charting Runtime**: Custom declarative inline `<svg>` polylines and diagonal-patterned bars (`src/domain/forecast-geometry.ts`, `src/components/ForecastCharts.tsx`) avoid pulling external charting libraries (~120+ kB saved).
- **Bounded Server Cache + Request Dedupe (`src/services/cache.ts`)**: Bounded LRU `Map` (`maxEntries`) with in-flight request deduplication, asynchronous stale-while-revalidate refresh (`10 min`/`30 min` AQI, `24 h`/`48 h` geocoding), and `shouldCache` filtering so demo/degraded errors never poison live cache.
- **Parallel Fetches & Cancellation (`src/hooks/`)**: `useCityComparison.ts` dispatches `Promise.all` across up to 3 cities cleanly; `useCitySearch.ts` debounces queries (`300 ms`) and cancels superseded HTTP calls via `useAsyncResource.ts` (`AbortController`).
- **$O(n)$ Activity Scoring (`src/domain/planner.ts`)**: `scoreActivityWindows` scans up to 48 hourly points in a single linear pass ($O(n)$ time, tracking best/worst extremes in $O(1)$ extra tracking variables).
- **Repository Footprint (`scripts/audit.sh` Check 9)**: Total tracked workspace size **`~0.95 MB`** (`< 10 MB` cap).

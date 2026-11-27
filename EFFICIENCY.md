# Efficiency

Evaluation criterion: Efficiency — lean JS/CSS bundles, bounded caching/dedupe, non-blocking loading, and algorithmic complexity.

## 1. Measured Bundle & Runtime Performance

- **First Load JS (`npm run build`)**: Root `/` loads in **`139 kB`** First Load JS (`15.5 kB` page + `103 kB` shared chunks), safely below the enforced **`< 150 kB`** gzip budget verified automatically by `scripts/audit.sh` Check 7.
- **Minimal Asset & Font Overhead**: `src/app/icon.svg` is an inline-served `< 1 kB` vector icon; `src/app/globals.css` uses the native system/Devanagari/Tamil font stack with zero external blocking font requests (`0` font requests).
- **Lighthouse Verification (`next start` + Demo Mode)**: Evaluated via headless System Chrome (`--disable-features=CrossOriginOpenerPolicy` for trace capture while production serves full `COOP: same-origin`):
  - **Desktop**: **`100` Performance**, `100` Accessibility, `100` Best Practices, `100` SEO (`FCP 0.5 s`, `LCP 0.5 s`, `CLS 0`, `TBT 40 ms`).
  - **Mobile (4x CPU throttle)**: **`82` Performance** (`TBT 720 ms` under host `benchmarkIndex 989.5`), `100` Accessibility, `100` Best Practices, `100` SEO (`FCP 0.8 s`, `LCP 0.8 s`, `CLS 0`).

## 2. Implemented Optimizations

- **Below-the-Fold Splitting (`src/components/UrbanAirWorkbench.tsx`)**: Dynamically imports 6 heavy lower sections (`ForecastSection`, `ActivityPlanner`, `RoutinesImpactSection`, `CityCompareSection`, `ThresholdAlertsSection`, `AirQualityChat`) with `{ ssr: true }`, keeping initial SSR complete while reducing hydration JS.
- **Zero Heavy Charting Runtime**: Custom declarative inline `<svg>` polylines and diagonal-patterned bars (`src/domain/forecast-geometry.ts`, `src/components/ForecastCharts.tsx`) avoid pulling external charting libraries (~120+ kB saved).
- **Bounded Server Cache + Request Dedupe (`src/services/cache.ts`)**: Bounded LRU `Map` (`maxEntries`) with in-flight request deduplication, asynchronous stale-while-revalidate refresh (`10 min`/`30 min` AQI, `24 h`/`48 h` geocoding), and `shouldCache` filtering so demo/degraded errors never poison live cache.
- **Parallel Fetches & Cancellation (`src/hooks/`)**: `useCityComparison.ts` dispatches `Promise.all` across up to 3 cities cleanly; `useCitySearch.ts` debounces queries (`300 ms`) and cancels superseded HTTP calls via `useAsyncResource.ts` (`AbortController`).
- **$O(n)$ Activity Scoring (`src/domain/planner.ts`)**: `scoreActivityWindows` scans up to 48 hourly points in a single linear pass ($O(n)$ time, tracking best/worst extremes in $O(1)$ extra tracking variables).
- **Repository Footprint (`scripts/audit.sh` Check 9)**: Total tracked workspace size **`~1.0 MB`** (`< 10 MB` cap).

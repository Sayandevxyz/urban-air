# Performance Engineering & Measured Budgets

## 1. Enforced Budgets & Measured Production Results

Measured against `npm run analyze` (`ANALYZE=true next build`) and `npm run start -- -H 127.0.0.1 -p 3102` (`NEXT_PUBLIC_DEFAULT_DEMO_MODE=true`) using Playwright Chromium and system Chrome Lighthouse.

### Bundle Size & Core Telemetry (`next build`, Playwright)

| Metric                              | Budget                                        | Measured                                                                  | Status |
| ----------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- | ------ |
| First Load JS for `/`               | < 150 kB gzip                                 | **137 kB** (`13.6 kB` route + `103 kB` shared chunks + runtime chunks)    | PASS   |
| Shared JS Chunks                    | Minimize framework overhead                   | `46.6 kB` + `54.2 kB` + `2.14 kB`                                         | PASS   |
| Production CSS Bundle               | Lightweight utility stylesheet                | `20.1 KiB` (`20,567 B`)                                                   | PASS   |
| Edge Middleware Bundle              | Lightweight header pipeline                   | `34.4 kB`                                                                 | PASS   |
| App Icon Asset (`src/app/icon.svg`) | < 50 kB image ceiling                         | **< 1 kB** inline SVG (`0 B` JS overhead)                                 | PASS   |
| Fonts                               | System stack / zero blocking webfont requests | 0 font requests (`system-ui`, `Noto Sans` fallback)                       | PASS   |
| DOM Elements (initial Demo View)    | Lean semantic tree                            | `529` elements (`PW_COOP_RESULT`)                                         | PASS   |
| Unmodified COOP Navigation (Chrome) | Low shift & fast initial paint                | `COOP: same-origin`, `TTFB 250 ms`, `FCP 1040 ms`, `CLS 0.0053`, `155 KB` | PASS   |

Webpack bundle reports generated locally via `npm run analyze` (`openAnalyzer: false` in `next.config.ts`):

- `.next/analyze/client.html` (`362,686 B`)
- `.next/analyze/nodejs.html` (`404,499 B`)
- `.next/analyze/edge.html` (`278,072 B`)

### Lighthouse Audits (Headless Chrome)

| Profile                                | Performance | Accessibility | Best Practices | SEO     | FCP     | LCP     | CLS | TBT      | Max Potential FID |
| -------------------------------------- | ----------- | ------------- | -------------- | ------- | ------- | ------- | --- | -------- | ----------------- |
| **Desktop** (`--preset=desktop`)       | **100**     | **100**       | **100**        | **100** | `0.4 s` | `0.4 s` | `0` | `40 ms`  | `220 ms`          |
| **Mobile** (4x simulated CPU slowdown) | **95**      | **100**       | **100**        | **100** | `1.4 s` | `1.4 s` | `0` | `250 ms` | `340 ms`          |

> **Measurement Note (`COOP: same-origin` & Lighthouse Trace)**: Navigating directly from `about:blank` to an origin enforcing `Cross-Origin-Opener-Policy: same-origin` triggers a Chromium BrowsingContextGroup swap (new renderer frame ID), causing Lighthouse v13's `about:blank` -> navigation trace check to throw `NO_NAVSTART`. Local Lighthouse audits therefore pass `--disable-features=CrossOriginOpenerPolicy` solely in the Chrome CLI audit runner while production responses serve full `COOP: same-origin` isolation (verified independently in `PW_COOP_RESULT` and Playwright E2E).

---

## 2. Efficiency Optimizations Implemented

1. **Zero Heavyweight Chart / Font Runtime Bloat**
   - Charts (`src/components/HourlyChart.tsx`, `src/components/DailyTrend.tsx`, `src/domain/forecastChartGeometry.ts`) use pure declarative inline `<svg>` polylines, bar shapes, and SVG stripe `<pattern>` fills rather than pulling heavy D3/Recharts/canvas bundles, saving > 80 kB gzipped JS.
   - `src/app/globals.css` configures `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Devanagari", "Noto Sans Tamil", sans-serif` (zero external font fetches).
   - `src/app/icon.svg` eliminates the `/favicon.ico` 404 console error cleanly (< 1 kB SVG).

2. **Below-the-Fold Code Splitting (`next/dynamic`)**
   - `src/components/UrbanAirWorkbench.tsx` dynamically splits 6 below-the-fold sections (`ForecastSection`, `ActivityPlanner`, `RoutinesImpactSection`, `CityCompareSection`, `ThresholdAlertsSection`, `AirQualityChat`) with `{ ssr: true }`, keeping SSR HTML complete while bringing First Load JS on `/` down from `139 kB` to **`137 kB`**.

3. **Zero Hydration Redundant State Thrash**
   - `src/hooks/useAirQualityData.ts` (`skipInitialDemoRef`) and `src/hooks/useCityComparison.ts` (`skipInitialDemoRef`) initialize seeded Demo reports directly in initial state and skip duplicate mount `useEffect` state writes unless the user selects a city, switches demo mode, or adds a comparison city.

4. **Parallel Upstream & Multi-City Fetching (No Waterfalls)**
   - `src/services/open-meteo.ts` fetches current pollutants + hourly/daily forecasts cleanly in minimal round trips (`Promise.all` over multiple cities in `src/hooks/useCityComparison.ts` via shared `src/hooks/apiClient.ts`).

5. **Debounced Autocomplete & Cancellation**
   - `src/hooks/useCitySearch.ts` debounces typing by `300 ms` (`SEARCH_DEBOUNCE_MS`) and aborts any in-flight HTTP request via `AbortController` whenever the query changes, a city is selected, or the component unmounts.

6. **Bounded Server Cache with In-Flight Deduplication & SWR**
   - `src/services/cache.ts` provides a bounded `Map` LRU cache (`maxEntries`) preventing unbounded memory growth, deduplicates concurrent identical cache misses via an `inFlight` promise map, refreshes stale entries asynchronously in the background (`staleWhileRevalidate`), and uses `shouldCache` so transient degraded/demo fallbacks never poison live caches.
   - TTLs (`src/lib/constants.ts`): AQI fresh `10 min` / stale `30 min`; Geocoding fresh `24 h` / stale `48 h`.

7. **Algorithmic Complexity ($O(n)$ Planner)**
   - `scoreActivityWindows` (`src/domain/planner.ts`) performs a single $O(n)$ pass over the hourly forecast window (48 hours max), tracking the highest and lowest scored slot directly in $O(1)$ auxiliary space for best/worst extremes while preserving scored slot metadata.

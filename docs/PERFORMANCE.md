# Performance Engineering & Measured Budgets

## 1. Enforced Budgets & Measured Production Results

Measured against `npm run analyze` (`ANALYZE=true next build`) and `npm run start -- -p 3101` (`NEXT_PUBLIC_DEFAULT_DEMO_MODE=true`) using headless Chromium (`127.0.0.1:3101`).

### Bundle Size Budget (`next build`)

| Metric                              | Budget                                        | Measured                                                             | Status |
| ----------------------------------- | --------------------------------------------- | -------------------------------------------------------------------- | ------ |
| First Load JS for `/`               | < 150 kB gzip                                 | **137 kB** (`14 kB` route + `103 kB` shared chunks + runtime chunks) | PASS   |
| Shared JS Chunks                    | Minimize framework overhead                   | `46.6 kB` + `54.2 kB` + `2.11 kB`                                    | PASS   |
| Edge Middleware Bundle              | Lightweight header pipeline                   | `34.3 kB`                                                            | PASS   |
| App Icon Asset (`src/app/icon.svg`) | < 50 kB image ceiling                         | **< 1 kB** inline SVG (`0 B` JS overhead)                            | PASS   |
| Fonts                               | System stack / zero blocking webfont requests | 0 font requests (`system-ui`, `Noto Sans` fallback)                  | PASS   |
| DOM Elements (initial Demo View)    | Lean semantic tree                            | 507 elements                                                         | PASS   |

Webpack bundle reports generated locally via `npm run analyze`:

- `.next/analyze/client.html`
- `.next/analyze/nodejs.html`
- `.next/analyze/edge.html`

### Lighthouse Audits (Headless Chromium)

| Profile                                | Performance | Accessibility | Best Practices | SEO     | FCP     | LCP     | CLS | TBT        | Max Potential FID |
| -------------------------------------- | ----------- | ------------- | -------------- | ------- | ------- | ------- | --- | ---------- | ----------------- |
| **Desktop** (`--preset=desktop`)       | **97**      | **100**       | **100**        | **100** | `0.4 s` | `0.4 s` | `0` | `150 ms`   | `160 ms`          |
| **Mobile** (4× simulated CPU slowdown) | **73**      | **100**       | **100**        | **100** | `1.4 s` | `1.4 s` | `0` | `1,630 ms` | `890 ms`          |

- **Target status on desktop**: Performance `97` (>= 95), LCP `0.4 s` (< 2.0 s), CLS `0` (< 0.05), Max Potential FID `160 ms` (< 200 ms).
- **Mobile observation**: Under Lighthouse's 4× CPU slowdown throttle, LCP remains `1.4 s` (< 2.0 s) and CLS remains `0`, while `TBT` reflects initial hydration across all 8 interactive dashboard sections on mount (`chunks/4bd1b696` and root script parsing). Using a single client workbench preserves instantaneous 0 ms local city/persona/routine/impact recalculations with zero layout shift after load.

## 2. Efficiency Optimizations Implemented

1. **Zero Heavyweight Chart / Font Runtime Bloat**
   - Charts (`src/components/ForecastSection.tsx`) use pure declarative inline `<svg>` polylines, bar shapes, and SVG stripe `<pattern>` fills rather than pulling heavy D3/Recharts/canvas bundles, saving > 80 kB gzipped JS.
   - `src/app/globals.css` configures `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Devanagari", "Noto Sans Tamil", sans-serif` (zero external font fetches).
   - `src/app/icon.svg` eliminates the `/favicon.ico` 404 console error cleanly (< 1 kB SVG).

2. **Route-Level Code Splitting (`next/dynamic`)**
   - `src/components/UrbanAirWorkbench.tsx` splits `ForecastSection`, `RoutinesImpactSection`, `CityCompareSection`, and `AirQualityChat` into dynamic chunks (`831`, `889`, `812`, `294` in build output).

3. **Zero Hydration Redundant State Thrash**
   - `src/hooks/useAirQualityData.ts` (`skipInitialDemoRef`) and `src/hooks/useCityComparison.ts` (`skipInitialDemoRef`) initialize seeded Demo reports directly in initial state and skip duplicate mount `useEffect` state writes unless the user selects a city, switches demo mode, or adds a comparison city.

4. **Parallel Upstream & Multi-City Fetching (No Waterfalls)**
   - `src/services/open-meteo.ts` fetches current pollutants + hourly/daily forecasts cleanly in minimal round trips (`Promise.all` over multiple cities in `src/hooks/useCityComparison.ts`).

5. **Debounced Autocomplete & Cancellation**
   - `src/hooks/useCitySearch.ts` debounces typing by `300 ms` (`SEARCH_DEBOUNCE_MS`) and aborts any in-flight HTTP request via `AbortController` whenever the query changes or the component unmounts.

6. **Bounded Server Cache with In-Flight Deduplication & SWR**
   - `src/services/cache.ts` provides a bounded `Map` LRU cache (`maxEntries`) preventing unbounded memory growth, deduplicates concurrent identical cache misses via an `inFlight` promise map, refreshes stale entries asynchronously in the background (`staleWhileRevalidate`), and uses `shouldCache` so transient degraded/demo fallbacks never poison live caches.
   - TTLs (`src/lib/constants.ts`): AQI fresh `10 min` / stale `30 min`; Geocoding fresh `24 h` / stale `48 h`.

7. **Algorithmic Complexity ($O(n)$ Planner)**
   - `scoreActivityWindows` (`src/domain/planner.ts`) performs a single $O(n)$ pass over the hourly forecast window (48 hours max), tracking the highest and lowest scored slot directly in $O(1)$ auxiliary space for best/worst extremes while preserving scored slot metadata.

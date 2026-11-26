# UI Component Architecture (`src/components`)

Presentational React components and layout modules are intentionally kept barrel-free, small (<= 120–150 lines per file), and accessible (WCAG 2.2 AA/AAA).

```mermaid
flowchart TB
  WB["UrbanAirWorkbench"] --> HDR["AppHeader"]
  WB --> SRCH["CitySearchBar"] --> SCF["SearchComboboxField"] --> LIST["CitySuggestionsList"]
  WB --> STAT["StatusBanner"]
  WB --> DASH["AqiDashboard"]
  DASH --> HEAD["AqiHeadline"]
  DASH --> POLL["PollutantGrid"]
  WB --> FCST["ForecastSection"]
  FCST --> HC["HourlyChart"]
  FCST --> DT["DailyTrend"]
  FCST --> FDT["ForecastDataTable"]
  WB --> GUID["GuidanceSection"]
  GUID --> PICK["PersonaPicker"]
  GUID --> ADV["AdviceList"]
  WB --> PLAN["ActivityPlanner"]
  WB --> ROUT["RoutinesImpactSection"]
  ROUT --> RL["RoutineList"]
  ROUT --> CC["CommuteControls"]
  ROUT --> IMP["ImpactSummary"]
  WB --> CHAT["AirQualityChat"]
  CHAT --> CML["ChatMessageList"]
  CHAT --> CCM["ChatComposer"]
  WB --> CMP["CityCompareSection"] --> CT["CompareTable"]
  WB --> ALR["ThresholdAlertsSection"]
  ALR --> ARF["AlertRuleForm"]
  ALR --> ARL["AlertRuleList"]
  WB --> FTR["AppFooter"]
```

## Guardrails Enforced via ESLint (`eslint.config.mjs`)

- Pure hooks/services/domain functions: `max-lines-per-function: 40`, `complexity: 10`, `max-depth: 3`, `max-params: 4`, `max-lines: 250`.
- Component `.tsx` files: `max-lines-per-function: 80` (justified strictly for declarative accessible JSX).
- Zero ESLint disable comments, zero `any`, zero inline `style=` attributes, and zero barrel re-export files.

# Accessibility

Evaluation criterion: Accessibility — WCAG 2.2 AA compliance, non-color-alone signaling, keyboard operability, and responsive reflow.

## 1. Conformance Verification

- **WCAG 2.2 Level AA** (with `44+ px` touch targets, plain-language pollutant notes, and Light/Dark/High-Contrast support in `src/app/globals.css`).
- **Component Audits**: `jest-axe` runs inside all 3 files under `tests/components/` (`city-search-alerts.test.tsx`, `dashboard-forecast-guidance.test.tsx`, `compare-chat-workbench.test.tsx`) with **0 violations**.
- **End-to-End Audits (`tests/e2e/urban-air.spec.ts`)**: `@axe-core/playwright` (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`) passes with **0 violations** in both **Light** and **Dark** color schemes across `chromium-desktop` (`1280×720`) and `chromium-mobile` (`Pixel 7`), plus `320×640` horizontal reflow checks (`scrollWidth <= clientWidth`).

## 2. Accessible Design Matrix

| WCAG Criterion                   | Implementation & Module Evidence                                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1.1.1 Non-Text Content**       | SVG charts (`src/components/ForecastCharts.tsx`) include `role="img"`, dynamic `aria-label` ranges, and `<figcaption>`; icons set `aria-hidden`.                                                                         |
| **1.3.1 Info & Relationships**   | Single `<h1>`, semantic `<header>`, `<nav>`, `<main>`, `<footer>`, `<fieldset>` groups (`AppHeader.tsx`, `GuidanceSection.tsx`), `<th scope>` tables.                                                                    |
| **1.4.1 Use of Color**           | Every AQI tier pairs high-contrast color with a distinct SVG icon + category label + pattern label (`src/components/AqiVisuals.tsx`); bars use SVG `<pattern>`.                                                          |
| **1.4.3 / 1.4.6 Contrast**       | Dedicated Light, Dark (`prefers-color-scheme: dark`), High Contrast (`prefers-contrast: more`), and Windows Forced Colors tokens (`src/app/globals.css`).                                                                |
| **1.4.10 Reflow (320 px)**       | Wrapping headers, flexible grids, and scroll-isolated table regions (`ForecastSection.tsx`, `CityCompareSection.tsx`) prevent overflow.                                                                                  |
| **2.1.1 Keyboard & Combobox**    | ARIA APG combobox (`CitySearchCombobox.tsx`, `CitySearchBar.tsx`) with `ArrowDown/Up`, `Enter`, `Escape`; keyboard-focusable scrollable tables; IME-safe `AirQualityChat.tsx`.                                           |
| **2.4.1 / 2.4.7 Bypass & Focus** | Visually-hidden `"Skip to main content"` link targeting `#main-content` (`AppHeader.tsx`) and global `3px` `:focus-visible` outlines (`globals.css`).                                                                    |
| **2.5.8 Target Size (44+ px)**   | Buttons, switches, selects, and inputs enforce `min-h-[44px]` or `min-h-[48px]` (`src/components/UiPrimitives.tsx`, `GuidanceSection.tsx`).                                                                              |
| **3.1.1 / 3.3.1 / 4.1.3**        | Dynamic persisted `<html lang>` (`en`/`hi`/`ta` via `LocaleContext.tsx`), `noValidate` `aria-invalid`/`aria-describedby` alerts (`ThresholdAlertsSection.tsx`), `aria-live`/`role="alert"` regions (`StatusBanner.tsx`). |

## 3. Chart Data-Table Parity & Reduced Motion

Both 48-hour polyline charts and 7-day trend bar charts toggle seamlessly to semantic HTML `<table>` alternatives with exact numerical parity (`src/components/ForecastSection.tsx`). `prefers-reduced-motion: reduce` disables transitions and animations globally in `src/app/globals.css`.

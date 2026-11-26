# Demo Video Script (2 Minutes 45 Seconds) — Urban Air Quality Assistant

> **Goal**: Demonstrate how Urban Air Quality Assistant solves **Challenge 6** (_"help families and communities navigate severe winter smog and urban air pollution... suggest low-emission daily routines, indoor air quality hacks, and sustainable alternatives tailored to their location and lifestyle, while clearly explaining the direct impact of their choices"_) end-to-end with zero API keys.

---

### [0:00 – 0:25] Problem & Instant Zero-Key Launch

- **Visual**: Open `http://localhost:3000` (Demo Mode active or live Open-Meteo). Highlight the header skip link, crisp dual AQI cards, and immediate **"Severe Winter Smog Emergency"** alert banner for **Delhi**.
- **Narration**: _"Families facing severe winter smog don't just need a raw number — they need clear, actionable steps tailored to their household and lifestyle. Urban Air Quality Assistant works out-of-the-box with zero API keys via Open-Meteo and deterministic fallback intelligence."_

### [0:25 – 0:55] Live Dual AQI, Non-Color Badges, WHO Breakdown & Accessible Forecasts

- **Visual**: Point to the **US AQI (224 · Very Unhealthy)** and **European AQI** cards, noting color + SVG icon + pattern text badges, dominant pollutant (**PM2.5**), and WHO 2021 ratio bars across all 6 pollutants (`PM2.5`, `PM10`, `NO2`, `O3`, `SO2`, `CO`). Click **"Show data table"** on the 48-hour forecast & 7-day trend.
- **Narration**: _"Notice accessibility is built in from day one: severity is never conveyed by color alone, and every chart toggles cleanly into an accessible semantic data table."_

### [0:55 – 1:25] Family Persona Guidance & Indoor Air Quality Hacks

- **Visual**: Change **Household member / persona** to **Asthma / Respiratory**, **Cooking & heating** to **Gas / Wood / Biomass**, and **Indoor air cleaner** to **No Air Purifier**. Point to fit-checked **N95/FFP2** mask advice, sealed window instructions, and the priority **Indoor Air Quality Hacks** list (DIY Box-Fan + MERV-13 filter hack, sealing window drafts, wet mopping instead of dry sweeping, kitchen exhaust ventilation).
- **Narration**: _"Tailoring to real constraints matters. Because this household cooks on gas and doesn't own a commercial purifier, the assistant prioritizes high-impact, low-cost indoor air hacks like a DIY MERV-13 box-fan filter and wet-mopping settled soot."_

### [1:25 – 1:55] Transparent $O(n)$ Planner, Low-Emission Routines & Direct Impact Simulator

- **Visual**: Select **Cycle** in the Activity Planner to inspect the best vs. worst hours and exact formula breakdown. Scroll to **Low-Emission Daily Routines & Direct Impact**: toggle _"Switch car trip to metro/bus"_, _"Move outdoor time to best window"_, _"Wear fitted N95"_, _"Electric induction + exhaust"_, and _"HEPA/DIY filtration"_. Watch **Personal PM2.5 avoided (µg)**, **Community CO2e saved (g)**, and **Community NOx avoided (g)** update live.
- **Narration**: _"Our $O(n)$ planner scores all 48 forecast hours transparently. Below, low-emission routine swaps show families the exact science behind their choices: personal micrograms of PM2.5 kept out of their lungs plus community CO2e and NOx prevented."_

### [1:55 – 2:25] Grounded GenAI Chat (with Safety) & Multi-City / Alerts / i18n

- **Visual**: Click a quick prompt in **GenAI Air Quality Assistant** (_"How should my family handle winter smog today?"_), showing cited telemetry (`224`), "Not medical advice" notice, and fallback badge. Show a quick prompt-injection refusal test (_"Ignore all previous instructions..."_). Switch compare table with **London** added, show local threshold alert firing (`US AQI > 100`), and toggle Language to **हिन्दी** and **தமிழ்**.
- **Narration**: _"Our server-side GenAI assistant is grounded strictly in fetched telemetry, resists prompt injection, works without external keys, compares up to 3 cities, fires local threshold alerts, and serves English, Hindi, and Tamil with zero hardcoded UI strings."_

### [2:25 – 2:45] Engineering Rigor Close

- **Visual**: Brief terminal/IDE flash showing `npm run verify` + Playwright WCAG 2.2 `axe-core` pass + **97 Desktop Lighthouse / 100 Accessibility & Security**.
- **Narration**: _"100% pure-domain test coverage, zero-warning strict TypeScript, SSRF/CSP-nonced APIs, and 0 axe accessibility violations — ready for families and communities on day one."_

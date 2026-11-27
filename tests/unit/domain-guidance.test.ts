// ============================================================================
// tests/unit/domain-guidance.test.ts
// Tests personalized 7-persona protection advice and contextual indoor hacks.
// ============================================================================

import { expect, test } from "vitest";
import { assessWinterSmog } from "@/domain/aqi";
import { buildIndoorAirHacks, buildPersonaGuidance } from "@/domain/guidance";
import type { HourlyForecastPoint, PollutantReadings } from "@/types/air-quality";
import type { PersonaId, ResidentProfile } from "@/types/guidance";

const BASE: ResidentProfile = {
  persona: "general",
  commuteMode: "car",
  homeEnergyMode: "gas_biomass",
  filtrationMode: "none",
};
const SEVERE: PollutantReadings = { pm25: 120, pm10: 210, no2: 92, o3: 35, so2: 18, co: 1900 };
const CLEAN: PollutantReadings = { pm25: 7, pm10: 19, no2: 14, o3: 40, so2: 4, co: 200 };

const mkHr = (
  hr: string,
  usAqi: number,
  vals: [number, number, number, number, number],
): HourlyForecastPoint => ({
  timeIso: `2026-11-26T${hr}:00:00Z`,
  usAqi,
  europeanAqi: vals[0],
  pm25: vals[1],
  pm10: vals[2],
  no2: vals[3],
  o3: vals[4],
});

const HOURLY: readonly HourlyForecastPoint[] = [
  mkHr("08", 190, [95, 110, 180, 90, 30]),
  mkHr("15", 72, [42, 22, 48, 30, 55]),
  mkHr("21", 165, [82, 75, 140, 70, 25]),
];

const MASK = {
  n: "none_needed",
  o: "optional_sensitive",
  r: "n95_recommended",
  q: "n95_required",
} as const;
const WIN = {
  o: "open_cross_ventilation",
  b: "brief_clean_window",
  s: "keep_sealed",
} as const;
const OUT = {
  n: "normal_outdoor",
  p: "pace_outdoors",
  s: "shift_indoors",
  a: "avoid_outdoors",
} as const;

type CompactCase = readonly [
  number,
  PersonaId,
  PollutantReadings,
  keyof typeof MASK,
  keyof typeof WIN,
  keyof typeof OUT,
  boolean,
];

const CASES: readonly CompactCase[] = [
  [50, "children", { ...CLEAN, o3: 99 }, "n", "o", "n", false],
  [51, "children", { ...CLEAN, o3: 100 }, "o", "b", "n", false],
  [85, "asthma", { ...CLEAN, pm25: 28 }, "o", "b", "n", false],
  [85, "general", { ...CLEAN, pm25: 28 }, "n", "b", "n", false],
  [101, "general", CLEAN, "r", "b", "p", false],
  [135, "worker", { ...CLEAN, pm25: 48 }, "r", "b", "p", false],
  [135, "asthma", { ...CLEAN, pm25: 48 }, "r", "b", "s", true],
  [150, "general", CLEAN, "r", "b", "p", false],
  [151, "general", CLEAN, "q", "s", "s", true],
  [175, "general", { ...CLEAN, pm25: 75, o3: 115 }, "q", "s", "s", true],
  [175, "asthma", { ...CLEAN, pm25: 75 }, "q", "s", "a", true],
  [201, "general", SEVERE, "q", "s", "a", true],
];

const runGuide = (
  usAqi: number,
  readings: PollutantReadings,
  persona: PersonaId = "general",
  hourly: readonly HourlyForecastPoint[] = HOURLY,
) =>
  buildPersonaGuidance({
    usAqi,
    smog: assessWinterSmog(usAqi, readings),
    readings,
    profile: { ...BASE, persona },
    hourly,
  });

const runHacks = (
  usAqi: number,
  readings: PollutantReadings,
  overrides: Partial<ResidentProfile> = {},
) =>
  buildIndoorAirHacks(usAqi, assessWinterSmog(usAqi, readings), readings, {
    ...BASE,
    ...overrides,
  });

test("provides tailored guidance across all 7 personas in clean and severe smog conditions", () => {
  const personas: readonly PersonaId[] = [
    "general",
    "children",
    "elderly",
    "asthma",
    "pregnant",
    "athlete",
    "worker",
  ];
  for (const persona of personas) {
    const clean = runGuide(35, CLEAN, persona);
    expect([clean.maskAdvice, clean.windowsAdvice]).toEqual([
      "none_needed",
      "open_cross_ventilation",
    ]);
    const severe = runGuide(205, SEVERE, persona);
    expect([severe.maskAdvice, severe.windowsAdvice, severe.highSensitivityWarning]).toEqual([
      "n95_required",
      "keep_sealed",
      true,
    ]);
  }
});

test.each(CASES)("maps AQI %i (%s) to exact mask, window, and activity limits", (...row) => {
  const [usAqi, persona, readings, maskKey, winKey, outKey, warn] = row;
  const res = runGuide(usAqi, readings, persona);
  expect([
    res.maskAdvice,
    res.windowsAdvice,
    res.outdoorAdvice,
    res.highSensitivityWarning,
  ]).toEqual([MASK[maskKey], WIN[winKey], OUT[outKey], warn]);
  expect(res.recommendedWindowIso).toBe("2026-11-26T15:00:00Z");
  expect(res.checklistKeys.includes("ozone_avoid_afternoon_peak")).toBe(readings.o3 >= 100);
});

test("handles empty hourly arrays and selects severe/no-filter vs moderate/HEPA indoor hacks", () => {
  expect(runGuide(115, { ...CLEAN, pm25: 41 }, "general", []).recommendedWindowIso).toBeUndefined();
  expect(runHacks(210, SEVERE).map((h) => h.id)).toEqual([
    "seal_smog_drafts",
    "build_diy_box_filter",
    "exhaust_or_induction_cook",
    "wet_mop_dust",
    "stop_indoor_combustion",
  ]);
  expect(
    runHacks(
      100,
      { ...CLEAN, no2: 39 },
      { filtrationMode: "hepa", homeEnergyMode: "electric_induction" },
    ),
  ).toEqual([
    { id: "timed_window_purge", priority: "standard" },
    { id: "run_hepa_filtration", priority: "high" },
    { id: "wet_mop_dust", priority: "standard" },
    { id: "stop_indoor_combustion", priority: "standard" },
  ]);
});

test("prioritizes indoor hacks cleanly at AQI 101, severe HEPA, and DIY box fan tiers", () => {
  const b101 = runHacks(
    101,
    { ...CLEAN, no2: 40 },
    { filtrationMode: "hepa", homeEnergyMode: "electric_induction" },
  );
  expect(b101.find((h) => h.id === "run_hepa_filtration")?.priority).toBe("critical");
  expect(b101.find((h) => h.id === "exhaust_or_induction_cook")?.priority).toBe("high");

  const severeHepa = runHacks(151, SEVERE, {
    filtrationMode: "hepa",
    homeEnergyMode: "electric_induction",
  });
  expect(severeHepa.find((h) => h.id === "seal_smog_drafts")?.priority).toBe("critical");

  const cleanDiy = runHacks(30, CLEAN, {
    filtrationMode: "diy_box_fan",
    homeEnergyMode: "electric_induction",
  });
  expect(cleanDiy.find((h) => h.id === "build_diy_box_filter")?.priority).toBe("high");
});

// ============================================================================
// tests/unit/domain-planner-alerts.test.ts
// Tests O(n) activity window scoring and local threshold alert evaluation.
// ============================================================================

import { expect, test } from "vitest";
import { evaluateThresholdAlerts } from "@/domain/alerts";
import { scoreActivityWindows } from "@/domain/planner";
import type { AirQualityReport, HourlyForecastPoint } from "@/types/air-quality";
import type { ThresholdAlertRule } from "@/types/guidance";

const mkPt = (
  hr: string,
  usAqi = 20,
  vals: [number, number, number, number, number] = [10, 5, 10, 10, 30],
): HourlyForecastPoint => ({
  timeIso: `2026-11-26T${hr}:00:00Z`,
  usAqi,
  europeanAqi: vals[0],
  pm25: vals[1],
  pm10: vals[2],
  no2: vals[3],
  o3: vals[4],
});

const FORECAST_24H: readonly HourlyForecastPoint[] = [
  mkPt("06", 185, [92, 105, 180, 88, 24]),
  mkPt("09", 155, [78, 68, 130, 75, 38]),
  mkPt("14", 68, [38, 18, 42, 24, 52]),
  mkPt("16", 82, [46, 25, 55, 32, 112]),
  mkPt("22", 168, [84, 85, 145, 78, 20]),
];

const SAMPLE_REPORT: AirQualityReport = {
  location: {
    key: "delhi",
    name: "Delhi",
    region: "Delhi",
    country: "India",
    latitude: 28.61,
    longitude: 77.21,
    timezone: "Asia/Kolkata",
  },
  updatedAtIso: "2026-11-26T08:00:00Z",
  source: "demo",
  current: {
    usAqi: 245,
    europeanAqi: 108,
    readings: { pm25: 165, pm10: 290, no2: 95, o3: 32, so2: 22, co: 2500 },
  },
  hourly: [],
  daily: [],
};

const mkRule = (
  id: string,
  cityKey: string,
  metric: "usAqi" | "pm25",
  opts: { threshold: number; enabled: boolean },
): ThresholdAlertRule => ({
  id,
  cityKey,
  cityName: cityKey === "delhi" ? "Delhi" : "London",
  metric,
  threshold: opts.threshold,
  enabled: opts.enabled,
});

test("scoreActivityWindows ranks daylight windows with exact penalty math", () => {
  const runPlan = scoreActivityWindows(FORECAST_24H, "run", "athlete");
  expect(runPlan.bestWindow).toMatchObject({
    timeIso: "2026-11-26T14:00:00Z",
    aqiPenalty: 42,
    pollutantPenalty: 8,
    timeSuitabilityBonus: 6,
    score: 56,
  });
  expect(runPlan.worstWindow).toMatchObject({
    timeIso: "2026-11-26T06:00:00Z",
    aqiPenalty: 75,
    pollutantPenalty: 25,
    timeSuitabilityBonus: -4,
    score: 0,
  });
  expect(runPlan.timeline).toHaveLength(5);
  expect(scoreActivityWindows(FORECAST_24H, "cycle", "general").bestWindow?.aqiPenalty).toBe(36);
  const asthmaWalk = scoreActivityWindows(FORECAST_24H, "walk", "asthma").bestWindow?.score ?? 0;
  expect(asthmaWalk).toBeLessThan(
    scoreActivityWindows(FORECAST_24H, "walk", "general").bestWindow?.score ?? 0,
  );
});

test("scoreActivityWindows handles ventilation timing, invalid timestamps, empty input, and caps", () => {
  const ventPlan = scoreActivityWindows(
    [
      ...FORECAST_24H,
      mkPt("18", 90),
      { ...mkPt("00", 75, [40, 20, 45, 25, 40]), timeIso: "invalid-iso" },
    ],
    "ventilate",
    "general",
  );
  expect(ventPlan.bestWindow?.timeIso).toBe("2026-11-26T14:00:00Z");
  expect(
    ventPlan.timeline.find((p) => p.timeIso === "2026-11-26T18:00:00Z")?.timeSuitabilityBonus,
  ).toBe(0);
  expect(scoreActivityWindows([], "walk", "general")).toMatchObject({
    bestWindow: undefined,
    worstWindow: undefined,
    timeline: [],
  });
  expect(scoreActivityWindows(FORECAST_24H, "walk", "general", 2).timeline).toHaveLength(2);
  const ventBonuses = scoreActivityWindows(
    ["06", "07", "10", "11", "16", "17", "20", "21"].map((h) => mkPt(h)),
    "ventilate",
    "general",
  ).timeline.map((p) => p.timeSuitabilityBonus);
  expect(ventBonuses).toEqual([-6, 0, 0, 8, 8, 0, 0, -6]);
  const walkBonuses = scoreActivityWindows(
    ["06", "07", "19", "20"].map((h) => mkPt(h)),
    "walk",
    "general",
  );
  expect(walkBonuses.timeline.map((p) => p.timeSuitabilityBonus)).toEqual([-4, 6, 6, -4]);
});

test("evaluateThresholdAlerts fires only for enabled matching rules strictly above threshold", () => {
  const rules: readonly ThresholdAlertRule[] = [
    mkRule("r1", "delhi", "usAqi", { threshold: 100, enabled: true }),
    mkRule("r2", "delhi", "pm25", { threshold: 200, enabled: true }),
    mkRule("r3", "delhi", "pm25", { threshold: 100, enabled: false }),
    mkRule("r4", "london", "usAqi", { threshold: 50, enabled: true }),
    mkRule("r5", "delhi", "usAqi", { threshold: 245, enabled: true }),
  ];
  expect(evaluateThresholdAlerts(rules, { delhi: SAMPLE_REPORT })).toEqual([
    {
      ruleId: "r1",
      cityKey: "delhi",
      cityName: "Delhi",
      metric: "usAqi",
      threshold: 100,
      actualValue: 245,
    },
  ]);
  const pmAlerts = evaluateThresholdAlerts(
    [mkRule("pm", "delhi", "pm25", { threshold: 50, enabled: true })],
    {
      delhi: SAMPLE_REPORT,
    },
  );
  expect(pmAlerts[0]?.actualValue).toBe(165);
});

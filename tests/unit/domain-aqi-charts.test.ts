// ============================================================================
// tests/unit/domain-aqi-charts.test.ts
// Tests EPA/EAQI breakpoints, winter smog rules, and SVG chart geometry math.
// ============================================================================

import { expect, test } from "vitest";
import {
  assessPollutants,
  assessWinterSmog,
  classifyUsAqi,
  computeEuropeanAqiBand,
  findDominantPollutant,
} from "@/domain/aqi";
import {
  POLLUTANT_KEYS,
  calculatePollutantUsAqi,
  computeCompositeUsAqi,
  estimateEuropeanAqiFromPollutants,
} from "@/domain/aqi-breakpoints";
import {
  CHART_HEIGHT,
  CHART_INNER_HEIGHT,
  CHART_INNER_WIDTH,
  CHART_PAD_LEFT,
  CHART_PAD_TOP,
  buildDailyGeometry,
  buildHourlyGeometry,
  computeChartY,
  computeHourlyX,
} from "@/domain/forecast-geometry";
import type {
  DailyTrendPoint,
  HourlyForecastPoint,
  PollutantKey,
  PollutantReadings,
} from "@/types/air-quality";

const CLEAN: PollutantReadings = { pm25: 6, pm10: 18, no2: 12, o3: 45, so2: 5, co: 250 };
const SMOG: PollutantReadings = { pm25: 145, pm10: 260, no2: 95, o3: 32, so2: 24, co: 2400 };

test.each<[PollutantKey, number, number]>([
  ["pm25", -5, 0],
  ["pm25", 0, 0],
  ["pm25", 9.0, 50],
  ["pm25", 9.1, 51],
  ["pm25", 35.4, 100],
  ["pm25", 35.5, 101],
  ["pm25", 55.4, 150],
  ["pm25", 55.5, 151],
  ["pm25", 125.4, 200],
  ["pm25", 225.4, 300],
  ["pm25", 325.4, 400],
  ["pm25", 500.4, 500],
  ["pm25", 650, 500],
  ["pm10", 0, 0],
  ["pm10", 54, 50],
  ["pm10", 155, 101],
  ["pm10", 354, 200],
  ["pm10", 604, 500],
  ["o3", 108, 50],
  ["o3", 210, 200],
  ["o3", 400, 300],
  ["no2", 100, 50],
  ["no2", 675, 150],
  ["no2", 2400, 500],
  ["so2", 92, 50],
  ["so2", 1582, 300],
  ["co", 5000, 50],
  ["co", 34800, 300],
])("computes EPA 2024 sub-index for %s at %s ug/m3 => %s", (key, val, expected) => {
  expect(calculatePollutantUsAqi(key, val)).toBe(expected);
});

test("classifies dual US/EAQI bands with unique non-color icons and patterns", () => {
  expect(computeCompositeUsAqi(CLEAN)).toBe(33);
  expect(computeCompositeUsAqi(SMOG)).toBe(220);
  expect(estimateEuropeanAqiFromPollutants(CLEAN)).toBe(12);
  expect(estimateEuropeanAqiFromPollutants(SMOG)).toBe(120);

  const sampleTiers = [25, 50, 51, 100, 101, 150, 151, 200, 201, 300, 301];
  expect(sampleTiers.map((v) => classifyUsAqi(v).category)).toEqual([
    "good",
    "good",
    "moderate",
    "moderate",
    "sensitive",
    "sensitive",
    "unhealthy",
    "unhealthy",
    "very_unhealthy",
    "very_unhealthy",
    "hazardous",
  ]);
  expect(new Set([10, 75, 125, 175, 250, 350].map((v) => classifyUsAqi(v).iconId)).size).toBe(6);
  expect(new Set([10, 75, 125, 175, 250, 350].map((v) => classifyUsAqi(v).patternId)).size).toBe(6);
  expect([20, 21, 41, 61, 81, 101].map(computeEuropeanAqiBand)).toEqual([
    "good",
    "fair",
    "moderate",
    "poor",
    "very_poor",
    "extremely_poor",
  ]);
});

test("evaluates WHO guidelines and detects winter smog & inversion episodes", () => {
  const assessments = assessPollutants(SMOG);
  expect(assessments).toHaveLength(POLLUTANT_KEYS.length);
  expect(assessments.find((i) => i.key === "pm25")).toMatchObject({
    exceedsWho: true,
    whoRatio: 9.7,
    subIndexUsAqi: 220,
    isDominant: true,
  });
  expect(findDominantPollutant(assessments)).toBe("pm25");
  expect(findDominantPollutant(assessPollutants({ ...CLEAN, o3: 220 }))).toBe("o3");
  expect(findDominantPollutant([])).toBe("pm25");

  const atLimit = { pm25: 15, pm10: 45, no2: 25, o3: 100, so2: 40, co: 4000 };
  expect(assessPollutants(atLimit).every((i) => !i.exceedsWho)).toBe(true);
  expect(assessWinterSmog(100, atLimit)).toEqual({
    severity: "none",
    isWinterSmogAlert: false,
    inversionTrapLikely: false,
    primaryDrivers: [],
  });
  expect(assessWinterSmog(101, { ...CLEAN, pm25: 16, pm10: 46, no2: 26 })).toMatchObject({
    severity: "elevated",
    isWinterSmogAlert: false,
    primaryDrivers: ["pm25", "pm10", "no2"],
  });
  expect(assessWinterSmog(90, { ...CLEAN, pm25: 35.5 }).severity).toBe("elevated");
  expect(assessWinterSmog(151, { ...CLEAN, pm25: 55.4, pm10: 154 }).isWinterSmogAlert).toBe(true);
  expect(assessWinterSmog(120, { ...CLEAN, pm10: 155 }).severity).toBe("severe_smog");
  expect(assessWinterSmog(175, { ...CLEAN, pm25: 55.5, no2: 79 }).inversionTrapLikely).toBe(false);
  expect(assessWinterSmog(175, { ...CLEAN, pm25: 55.5, no2: 80 }).inversionTrapLikely).toBe(true);
  expect(assessWinterSmog(201, CLEAN).severity).toBe("smog_emergency");
  expect(assessWinterSmog(160, { ...CLEAN, pm25: 125.5 }).severity).toBe("smog_emergency");
  expect(assessWinterSmog(200, { ...CLEAN, pm25: 125.4 }).severity).toBe("severe_smog");
});

test("computes hourly SVG polyline coordinates and daily bar geometry accurately", () => {
  expect(computeHourlyX(0, 1)).toBe(CHART_PAD_LEFT + CHART_INNER_WIDTH / 2);
  expect(computeChartY(0, 100)).toBe(CHART_PAD_TOP + CHART_INNER_HEIGHT);
  expect(computeChartY(100, 0)).toBe(CHART_PAD_TOP + CHART_INNER_HEIGHT - 100 * CHART_INNER_HEIGHT);
  expect(buildHourlyGeometry([])).toMatchObject({
    minHourly: 0,
    maxHourly: 100,
    chartMax: 120,
    polylinePoints: "",
    tickMarkers: [],
  });

  const hourly: HourlyForecastPoint[] = Array.from({ length: 13 }, (_, idx) => ({
    timeIso: `2026-11-26T${String(idx).padStart(2, "0")}:00:00Z`,
    usAqi: 60 + idx * 10,
    europeanAqi: 30 + idx * 4,
    pm25: 15 + idx * 3,
    pm10: 30,
    no2: 20,
    o3: 40,
  }));
  const geo = buildHourlyGeometry(hourly);
  expect(geo.tickMarkers.map((m) => m.label)).toEqual(["00:00", "06:00", "12:00"]);
  expect(geo.polylinePoints.split(" ")[0]).toBe("40,139");

  const daily: DailyTrendPoint[] = [
    { dateIso: "2026-11-26", avgUsAqi: 0, maxUsAqi: 20, minUsAqi: 0, avgPm25: 2 },
    { dateIso: "2026-11-27", avgUsAqi: 180, maxUsAqi: 210, minUsAqi: 120, avgPm25: 90 },
  ];
  const bars = buildDailyGeometry(daily).bars;
  expect(bars[0]).toMatchObject({ dateLabel: "11-26", width: 48, x: 162, y: 186, height: 6 });
  expect(bars[1]?.y).toBeGreaterThanOrEqual(CHART_PAD_TOP);
  expect((bars[1]?.y ?? 0) + (bars[1]?.height ?? 0)).toBeLessThanOrEqual(CHART_HEIGHT);
});

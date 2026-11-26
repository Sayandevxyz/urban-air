import { describe, expect, it } from "vitest";
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
} from "@/domain/forecastChartGeometry";
import type { DailyTrendPoint, HourlyForecastPoint } from "@/domain/types";

describe("domain/forecastChartGeometry", () => {
  it("computes single-point and multi-point hourly SVG geometry accurately", () => {
    expect(computeHourlyX(0, 1)).toBe(CHART_PAD_LEFT + CHART_INNER_WIDTH / 2);
    expect(computeChartY(0, 100)).toBe(CHART_PAD_TOP + CHART_INNER_HEIGHT);
    expect(computeChartY(100, 0)).toBe(
      CHART_PAD_TOP + CHART_INNER_HEIGHT - 100 * CHART_INNER_HEIGHT,
    );

    const empty = buildHourlyGeometry([]);
    expect(empty.minHourly).toBe(0);
    expect(empty.maxHourly).toBe(100);
    expect(empty.chartMax).toBe(120);
    expect(empty.polylinePoints).toBe("");
    expect(empty.tickMarkers).toHaveLength(0);

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
    expect(geo.minHourly).toBe(60);
    expect(geo.maxHourly).toBe(180);
    expect(geo.chartMax).toBe(200);
    expect(geo.tickMarkers.map((m) => m.label)).toEqual(["00:00", "06:00", "12:00"]);
    expect(geo.polylinePoints.split(" ")).toHaveLength(13);
  });

  it("computes daily bar positions and min height bounds for 7-day trend charts", () => {
    const daily: DailyTrendPoint[] = [
      { dateIso: "2026-11-26", avgUsAqi: 0, maxUsAqi: 20, minUsAqi: 0, avgPm25: 2 },
      { dateIso: "2026-11-27", avgUsAqi: 180, maxUsAqi: 210, minUsAqi: 120, avgPm25: 90 },
    ];
    const result = buildDailyGeometry(daily);
    expect(result.dailyMax).toBe(210);
    expect(result.bars).toHaveLength(2);
    expect(result.bars[0]?.dateLabel).toBe("11-26");
    expect(result.bars[0]?.height).toBe(6);
    expect(result.bars[1]?.y).toBeGreaterThanOrEqual(CHART_PAD_TOP);
    expect((result.bars[1]?.y ?? 0) + (result.bars[1]?.height ?? 0)).toBeLessThanOrEqual(
      CHART_HEIGHT,
    );
  });
});

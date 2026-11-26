import { describe, expect, it } from "vitest";
import { evaluateThresholdAlerts } from "@/domain/alerts";
import type { AirQualityReport, ThresholdAlertRule } from "@/domain/types";

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

describe("domain/alerts", () => {
  it("triggers alerts only for enabled matching rules that exceed threshold", () => {
    const rules: readonly ThresholdAlertRule[] = [
      {
        id: "r1",
        cityKey: "delhi",
        cityName: "Delhi",
        metric: "usAqi",
        threshold: 100,
        enabled: true,
      },
      {
        id: "r2",
        cityKey: "delhi",
        cityName: "Delhi",
        metric: "pm25",
        threshold: 200,
        enabled: true,
      },
      {
        id: "r3",
        cityKey: "delhi",
        cityName: "Delhi",
        metric: "pm25",
        threshold: 100,
        enabled: false,
      },
      {
        id: "r4",
        cityKey: "london",
        cityName: "London",
        metric: "usAqi",
        threshold: 50,
        enabled: true,
      },
    ];

    const triggered = evaluateThresholdAlerts(rules, { delhi: SAMPLE_REPORT });
    expect(triggered).toEqual([
      {
        ruleId: "r1",
        cityKey: "delhi",
        cityName: "Delhi",
        metric: "usAqi",
        threshold: 100,
        actualValue: 245,
      },
    ]);

    expect(
      evaluateThresholdAlerts(
        [
          {
            id: "eq-boundary",
            cityKey: "delhi",
            cityName: "Delhi",
            metric: "usAqi",
            threshold: 245,
            enabled: true,
          },
        ],
        { delhi: SAMPLE_REPORT },
      ),
    ).toEqual([]);
  });

  it("evaluates pm25 metric alerts when breached", () => {
    const triggered = evaluateThresholdAlerts(
      [
        {
          id: "r5",
          cityKey: "delhi",
          cityName: "Delhi",
          metric: "pm25",
          threshold: 50,
          enabled: true,
        },
      ],
      { delhi: SAMPLE_REPORT },
    );
    expect(triggered).toHaveLength(1);
    expect(triggered[0]?.actualValue).toBe(165);
  });
});

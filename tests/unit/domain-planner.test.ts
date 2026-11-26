import { describe, expect, it } from "vitest";
import { scoreActivityWindows } from "@/domain/planner";
import type { HourlyForecastPoint } from "@/domain/types";

const FORECAST_24H: readonly HourlyForecastPoint[] = [
  {
    timeIso: "2026-11-26T06:00:00Z",
    usAqi: 185,
    europeanAqi: 92,
    pm25: 105,
    pm10: 180,
    no2: 88,
    o3: 24,
  },
  {
    timeIso: "2026-11-26T09:00:00Z",
    usAqi: 155,
    europeanAqi: 78,
    pm25: 68,
    pm10: 130,
    no2: 75,
    o3: 38,
  },
  {
    timeIso: "2026-11-26T14:00:00Z",
    usAqi: 68,
    europeanAqi: 38,
    pm25: 18,
    pm10: 42,
    no2: 24,
    o3: 52,
  },
  {
    timeIso: "2026-11-26T16:00:00Z",
    usAqi: 82,
    europeanAqi: 46,
    pm25: 25,
    pm10: 55,
    no2: 32,
    o3: 112,
  },
  {
    timeIso: "2026-11-26T22:00:00Z",
    usAqi: 168,
    europeanAqi: 84,
    pm25: 85,
    pm10: 145,
    no2: 78,
    o3: 20,
  },
];

describe("domain/planner (O(n) scoring)", () => {
  it("picks the lowest-pollution daylight window for running and cycling", () => {
    const runPlan = scoreActivityWindows(FORECAST_24H, "run", "athlete");
    expect(runPlan.bestWindow?.timeIso).toBe("2026-11-26T14:00:00Z");
    expect(runPlan.worstWindow?.timeIso).toBe("2026-11-26T06:00:00Z");
    expect(runPlan.timeline).toHaveLength(5);

    const cyclePlan = scoreActivityWindows(FORECAST_24H, "cycle", "general");
    expect(cyclePlan.bestWindow?.timeIso).toBe("2026-11-26T14:00:00Z");
  });

  it("applies stricter sensitivity penalties for asthma/elderly/pregnant/children personas", () => {
    const generalWalk = scoreActivityWindows(FORECAST_24H, "walk", "general");
    const asthmaWalk = scoreActivityWindows(FORECAST_24H, "walk", "asthma");
    const generalBest = generalWalk.bestWindow?.score ?? 0;
    const asthmaBest = asthmaWalk.bestWindow?.score ?? 0;
    expect(asthmaBest).toBeLessThan(generalBest);
  });

  it("scores ventilation windows higher during cleaner midday dispersion and handles malformed timestamps", () => {
    const ventPlan = scoreActivityWindows(
      [
        ...FORECAST_24H,
        {
          timeIso: "2026-11-26T18:00:00Z",
          usAqi: 90,
          europeanAqi: 45,
          pm25: 25,
          pm10: 50,
          no2: 30,
          o3: 45,
        },
        { timeIso: "invalid-iso", usAqi: 75, europeanAqi: 40, pm25: 20, pm10: 45, no2: 25, o3: 40 },
      ],
      "ventilate",
      "general",
    );
    expect(ventPlan.bestWindow?.timeIso).toBe("2026-11-26T14:00:00Z");
    expect(ventPlan.bestWindow?.timeSuitabilityBonus).toBeGreaterThan(0);
    const eveningPoint = ventPlan.timeline.find((p) => p.timeIso === "2026-11-26T18:00:00Z");
    expect(eveningPoint?.timeSuitabilityBonus).toBe(0);
  });

  it("handles empty forecast arrays and respects custom windowHours cap", () => {
    const emptyPlan = scoreActivityWindows([], "walk", "general");
    expect(emptyPlan.bestWindow).toBeUndefined();
    expect(emptyPlan.worstWindow).toBeUndefined();
    expect(emptyPlan.timeline).toEqual([]);

    const capped = scoreActivityWindows(FORECAST_24H, "walk", "general", 2);
    expect(capped.timeline).toHaveLength(2);
    expect(capped.bestWindow?.timeIso).toBe("2026-11-26T09:00:00Z");
    expect(capped.worstWindow?.timeIso).toBe("2026-11-26T06:00:00Z");
  });
});

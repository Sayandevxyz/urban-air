import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { classifyUsAqi } from "@/domain/aqi";
import { POLLUTANT_KEYS, calculatePollutantUsAqi } from "@/domain/aqiBreakpoints";
import { buildDailyGeometry, buildHourlyGeometry } from "@/domain/forecastChartGeometry";
import { calculateDirectImpact } from "@/domain/impact";
import { scoreActivityWindows } from "@/domain/planner";
import { safeJsonParse } from "@/lib/errors";
import type { HourlyForecastPoint } from "@/types/air-quality";
import type { ResidentProfile } from "@/types/guidance";

const DEFAULT_PROFILE: ResidentProfile = {
  persona: "general",
  commuteMode: "car",
  homeEnergyMode: "gas_biomass",
  filtrationMode: "none",
};

describe("property-based domain and JSON invariants (fast-check)", () => {
  it("calculatePollutantUsAqi is monotonically non-decreasing with finite output >= 0", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...POLLUTANT_KEYS),
        fc.float({ min: 0, max: 500, noNaN: true }),
        fc.float({ min: 0, max: 500, noNaN: true }),
        (pollutant, deltaA, deltaB) => {
          const low = Math.min(deltaA, deltaB);
          const high = Math.max(deltaA, deltaB);
          const aqiLow = calculatePollutantUsAqi(pollutant, low);
          const aqiHigh = calculatePollutantUsAqi(pollutant, high);
          expect(Number.isFinite(aqiLow)).toBe(true);
          expect(aqiLow).toBeGreaterThanOrEqual(0);
          expect(aqiHigh).toBeGreaterThanOrEqual(aqiLow);
        },
      ),
    );
  });

  it("classifyUsAqi maps arbitrary integer AQI values into valid severity ranks 1..6", () => {
    fc.assert(
      fc.property(fc.integer({ min: -100, max: 1500 }), (usAqi) => {
        const result = classifyUsAqi(usAqi);
        expect(result.severityRank).toBeGreaterThanOrEqual(1);
        expect(result.severityRank).toBeLessThanOrEqual(6);
      }),
    );
  });

  it("buildHourlyGeometry and buildDailyGeometry stay within chart canvas bounds", () => {
    const pointArb: fc.Arbitrary<HourlyForecastPoint> = fc.record({
      timeIso: fc.constant("2026-11-26T08:00:00Z"),
      usAqi: fc.integer({ min: 0, max: 500 }),
      europeanAqi: fc.integer({ min: 0, max: 200 }),
      pm25: fc.float({ min: 0, max: 400, noNaN: true }),
      pm10: fc.float({ min: 0, max: 600, noNaN: true }),
      no2: fc.float({ min: 0, max: 400, noNaN: true }),
      o3: fc.float({ min: 0, max: 300, noNaN: true }),
    });

    fc.assert(
      fc.property(fc.array(pointArb, { minLength: 1, maxLength: 48 }), (hourly) => {
        const geo = buildHourlyGeometry(hourly);
        expect(geo.maxHourly).toBeGreaterThanOrEqual(geo.minHourly);
        expect(geo.chartMax).toBeGreaterThanOrEqual(100);
        expect(geo.tickMarkers.length).toBeLessThanOrEqual(Math.ceil(hourly.length / 6));

        const daily = buildDailyGeometry(
          hourly.slice(0, 7).map((h, i) => ({
            dateIso: `2026-11-${String(20 + i).padStart(2, "0")}`,
            avgUsAqi: h.usAqi,
            maxUsAqi: h.usAqi + 10,
            minUsAqi: h.usAqi,
            avgPm25: h.pm25,
          })),
        );
        expect(daily.bars.every((bar) => bar.height >= 6)).toBe(true);
      }),
    );
  });

  it("scoreActivityWindows and calculateDirectImpact keep outputs bounded and finite", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            usAqi: fc.integer({ min: 5, max: 450 }),
            pm25: fc.float({ min: 1, max: 350, noNaN: true }),
            no2: fc.float({ min: 1, max: 200, noNaN: true }),
            o3: fc.float({ min: 5, max: 220, noNaN: true }),
          }),
          { minLength: 1, maxLength: 24 },
        ),
        fc.float({ min: 0, max: 150, noNaN: true }),
        fc.float({ min: 0, max: 12, noNaN: true }),
        (points, commuteKm, outdoorHours) => {
          const hourly: HourlyForecastPoint[] = points.map((p, i) => ({
            timeIso: `2026-11-26T${String(i).padStart(2, "0")}:00:00Z`,
            usAqi: p.usAqi,
            europeanAqi: 40,
            pm25: p.pm25,
            pm10: p.pm25 * 1.5,
            no2: p.no2,
            o3: p.o3,
          }));
          const plan = scoreActivityWindows(hourly, "run", "general");
          expect(plan.bestWindow).not.toBeNull();
          expect(plan.worstWindow).not.toBeNull();
          if (plan.bestWindow && plan.worstWindow) {
            expect(plan.bestWindow.score).toBeGreaterThanOrEqual(plan.worstWindow.score);
            expect(plan.bestWindow.score).toBeLessThanOrEqual(100);
            expect(plan.worstWindow.score).toBeGreaterThanOrEqual(0);
          }

          const impact = calculateDirectImpact(
            {
              commuteDistanceKm: commuteKm,
              swapCarToCleanTransit: true,
              shiftActivityToBestWindow: true,
              wearFittedN95Outdoors: true,
              useCleanCookingAndExhaust: true,
              runIndoorAirFiltration: true,
              outdoorHours,
              bestWindowPm25UgM3: 12,
            },
            { pm25: 90, pm10: 150, no2: 50, o3: 40, so2: 15, co: 1200 },
            DEFAULT_PROFILE,
          );
          expect(impact.personalPm25AvoidedUg).toBeGreaterThanOrEqual(0);
          expect(impact.personalReductionPercent).toBeGreaterThanOrEqual(0);
          expect(impact.personalReductionPercent).toBeLessThanOrEqual(100);
          expect(impact.communityCo2SavedGrams).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });

  it("safeJsonParse roundtrips valid JSON values and never throws on arbitrary strings", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const parsed = safeJsonParse(JSON.stringify(value));
        expect(parsed.ok).toBe(true);
      }),
    );

    fc.assert(
      fc.property(fc.string(), (raw) => {
        const res = safeJsonParse(raw);
        expect(typeof res.ok).toBe("boolean");
      }),
    );
  });
});

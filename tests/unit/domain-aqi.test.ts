import { describe, expect, it } from "vitest";
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
} from "@/domain/aqiBreakpoints";
import type { PollutantReadings } from "@/domain/types";

const CLEAN_READINGS: PollutantReadings = {
  pm25: 6,
  pm10: 18,
  no2: 12,
  o3: 45,
  so2: 5,
  co: 250,
};

const WINTER_SMOG_READINGS: PollutantReadings = {
  pm25: 145,
  pm10: 260,
  no2: 95,
  o3: 32,
  so2: 24,
  co: 2400,
};

describe("domain/aqi", () => {
  it("calculates exact US EPA 2024 PM2.5 AQI breakpoints including boundary transitions", () => {
    expect(calculatePollutantUsAqi("pm25", 0)).toBe(0);
    expect(calculatePollutantUsAqi("pm25", 9.0)).toBe(50);
    expect(calculatePollutantUsAqi("pm25", 9.1)).toBe(51);
    expect(calculatePollutantUsAqi("pm25", 35.4)).toBe(100);
    expect(calculatePollutantUsAqi("pm25", 35.5)).toBe(101);
    expect(calculatePollutantUsAqi("pm25", 55.4)).toBe(150);
    expect(calculatePollutantUsAqi("pm25", 55.5)).toBe(151);
    expect(calculatePollutantUsAqi("pm25", 125.4)).toBe(200);
    expect(calculatePollutantUsAqi("pm25", 225.4)).toBe(300);
    expect(calculatePollutantUsAqi("pm25", 325.4)).toBe(400);
    expect(calculatePollutantUsAqi("pm25", 500.4)).toBe(500);
    expect(calculatePollutantUsAqi("pm25", 650)).toBe(500);
    expect(calculatePollutantUsAqi("pm25", -5)).toBe(0);
  });

  it("calculates sub-indices for PM10, NO2, O3, SO2, and CO", () => {
    expect(calculatePollutantUsAqi("pm10", 54)).toBe(50);
    expect(calculatePollutantUsAqi("pm10", 155)).toBe(101);
    expect(calculatePollutantUsAqi("o3", 108)).toBe(50);
    expect(calculatePollutantUsAqi("no2", 100)).toBe(50);
    expect(calculatePollutantUsAqi("so2", 92)).toBe(50);
    expect(calculatePollutantUsAqi("co", 5000)).toBe(50);
  });

  it("computes composite US AQI from the highest pollutant sub-index", () => {
    expect(computeCompositeUsAqi(CLEAN_READINGS)).toBe(33);
    expect(computeCompositeUsAqi(WINTER_SMOG_READINGS)).toBeGreaterThanOrEqual(210);
  });

  it("classifies all six US AQI bands with distinct icons and non-color patterns", () => {
    expect(classifyUsAqi(25).category).toBe("good");
    expect(classifyUsAqi(50).category).toBe("good");
    expect(classifyUsAqi(51).category).toBe("moderate");
    expect(classifyUsAqi(100).category).toBe("moderate");
    expect(classifyUsAqi(101).category).toBe("sensitive");
    expect(classifyUsAqi(150).category).toBe("sensitive");
    expect(classifyUsAqi(151).category).toBe("unhealthy");
    expect(classifyUsAqi(200).category).toBe("unhealthy");
    expect(classifyUsAqi(201).category).toBe("very_unhealthy");
    expect(classifyUsAqi(300).category).toBe("very_unhealthy");
    expect(classifyUsAqi(301).category).toBe("hazardous");

    const icons = new Set([10, 75, 125, 175, 250, 350].map((v) => classifyUsAqi(v).iconId));
    const patterns = new Set([10, 75, 125, 175, 250, 350].map((v) => classifyUsAqi(v).patternId));
    expect(icons.size).toBe(6);
    expect(patterns.size).toBe(6);
  });

  it("classifies all six European AQI bands and estimates EAQI from pollutants", () => {
    expect(computeEuropeanAqiBand(10)).toBe("good");
    expect(computeEuropeanAqiBand(35)).toBe("fair");
    expect(computeEuropeanAqiBand(55)).toBe("moderate");
    expect(computeEuropeanAqiBand(75)).toBe("poor");
    expect(computeEuropeanAqiBand(95)).toBe("very_poor");
    expect(computeEuropeanAqiBand(120)).toBe("extremely_poor");

    expect(estimateEuropeanAqiFromPollutants(CLEAN_READINGS)).toBeLessThanOrEqual(30);
    expect(estimateEuropeanAqiFromPollutants(WINTER_SMOG_READINGS)).toBeGreaterThanOrEqual(90);
  });

  it("evaluates all 6 pollutants against WHO 2021 guidelines and flags dominant pollutant", () => {
    const assessments = assessPollutants(WINTER_SMOG_READINGS);
    expect(assessments).toHaveLength(POLLUTANT_KEYS.length);
    const pm25 = assessments.find((item) => item.key === "pm25");
    expect(pm25?.exceedsWho).toBe(true);
    expect(pm25?.whoRatio).toBe(9.7);
    expect(findDominantPollutant(assessments)).toBe("pm25");

    const emptyDominant = findDominantPollutant([]);
    expect(emptyDominant).toBe("pm25");
  });

  it("detects severe winter smog and inversion traps from high particulate + NO2 signatures", () => {
    expect(assessWinterSmog(35, CLEAN_READINGS)).toEqual({
      severity: "none",
      isWinterSmogAlert: false,
      inversionTrapLikely: false,
      primaryDrivers: [],
    });

    const elevated = assessWinterSmog(120, { ...CLEAN_READINGS, pm25: 42, no2: 60 });
    expect(elevated.severity).toBe("elevated");
    expect(elevated.isWinterSmogAlert).toBe(false);

    const severe = assessWinterSmog(175, { ...CLEAN_READINGS, pm25: 72, no2: 85 });
    expect(severe.severity).toBe("severe_smog");
    expect(severe.isWinterSmogAlert).toBe(true);
    expect(severe.inversionTrapLikely).toBe(true);

    const emergency = assessWinterSmog(240, WINTER_SMOG_READINGS);
    expect(emergency.severity).toBe("smog_emergency");
    expect(emergency.isWinterSmogAlert).toBe(true);
    expect(emergency.primaryDrivers).toContain("pm25");
    expect(emergency.primaryDrivers).toContain("no2");
  });
});

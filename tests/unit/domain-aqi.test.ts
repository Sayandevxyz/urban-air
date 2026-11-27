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
import type { PollutantReadings } from "@/types/air-quality";

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
    expect(calculatePollutantUsAqi("pm10", 354)).toBe(200);
    expect(calculatePollutantUsAqi("pm10", 424)).toBe(300);
    expect(calculatePollutantUsAqi("pm10", 504)).toBe(400);
    expect(calculatePollutantUsAqi("pm10", 604)).toBe(500);
    expect(calculatePollutantUsAqi("o3", 108)).toBe(50);
    expect(calculatePollutantUsAqi("o3", 140)).toBe(100);
    expect(calculatePollutantUsAqi("o3", 210)).toBe(200);
    expect(calculatePollutantUsAqi("o3", 400)).toBe(300);
    expect(calculatePollutantUsAqi("no2", 100)).toBe(50);
    expect(calculatePollutantUsAqi("no2", 675)).toBe(150);
    expect(calculatePollutantUsAqi("no2", 2349)).toBe(300);
    expect(calculatePollutantUsAqi("no2", 2400)).toBe(500);
    expect(calculatePollutantUsAqi("so2", 92)).toBe(50);
    expect(calculatePollutantUsAqi("so2", 796)).toBe(200);
    expect(calculatePollutantUsAqi("so2", 1582)).toBe(300);
    expect(calculatePollutantUsAqi("co", 5000)).toBe(50);
    expect(calculatePollutantUsAqi("co", 17600)).toBe(200);
    expect(calculatePollutantUsAqi("co", 34800)).toBe(300);
    expect(calculatePollutantUsAqi("pm10", 0)).toBe(0);
  });

  it("computes composite US AQI from the highest pollutant sub-index", () => {
    expect(computeCompositeUsAqi(CLEAN_READINGS)).toBe(33);
    expect(computeCompositeUsAqi(WINTER_SMOG_READINGS)).toBe(220);
  });

  it("classifies all six US AQI bands with distinct icons and non-color patterns", () => {
    expect(classifyUsAqi(25)).toMatchObject({
      category: "good",
      severityRank: 1,
      iconId: "leaf",
      patternId: "solid",
      tokenName: "aqi-good",
    });
    expect(classifyUsAqi(50).category).toBe("good");
    expect(classifyUsAqi(51)).toMatchObject({
      category: "moderate",
      severityRank: 2,
      iconId: "sun-cloud",
      patternId: "dots",
      tokenName: "aqi-moderate",
    });
    expect(classifyUsAqi(100).category).toBe("moderate");
    expect(classifyUsAqi(101).category).toBe("sensitive");
    expect(classifyUsAqi(150).category).toBe("sensitive");
    expect(classifyUsAqi(151).category).toBe("unhealthy");
    expect(classifyUsAqi(200).category).toBe("unhealthy");
    expect(classifyUsAqi(201).category).toBe("very_unhealthy");
    expect(classifyUsAqi(300).category).toBe("very_unhealthy");
    expect(classifyUsAqi(301)).toEqual({
      category: "hazardous",
      severityRank: 6,
      iconId: "biohazard",
      patternId: "dense-bars",
      tokenName: "aqi-hazardous",
    });

    const icons = new Set([10, 75, 125, 175, 250, 350].map((v) => classifyUsAqi(v).iconId));
    const patterns = new Set([10, 75, 125, 175, 250, 350].map((v) => classifyUsAqi(v).patternId));
    expect(icons.size).toBe(6);
    expect(patterns.size).toBe(6);
  });

  it("classifies all six European AQI bands and estimates EAQI from pollutants", () => {
    expect(computeEuropeanAqiBand(20)).toBe("good");
    expect(computeEuropeanAqiBand(21)).toBe("fair");
    expect(computeEuropeanAqiBand(40)).toBe("fair");
    expect(computeEuropeanAqiBand(41)).toBe("moderate");
    expect(computeEuropeanAqiBand(60)).toBe("moderate");
    expect(computeEuropeanAqiBand(61)).toBe("poor");
    expect(computeEuropeanAqiBand(80)).toBe("poor");
    expect(computeEuropeanAqiBand(81)).toBe("very_poor");
    expect(computeEuropeanAqiBand(100)).toBe("very_poor");
    expect(computeEuropeanAqiBand(101)).toBe("extremely_poor");

    expect(estimateEuropeanAqiFromPollutants(CLEAN_READINGS)).toBe(12);
    expect(estimateEuropeanAqiFromPollutants(WINTER_SMOG_READINGS)).toBe(120);
  });

  it("evaluates all 6 pollutants against WHO 2021 guidelines and flags dominant pollutant", () => {
    const assessments = assessPollutants(WINTER_SMOG_READINGS);
    expect(assessments).toHaveLength(POLLUTANT_KEYS.length);
    const pm25 = assessments.find((item) => item.key === "pm25");
    expect(pm25?.exceedsWho).toBe(true);
    expect(pm25?.whoRatio).toBe(9.7);
    expect(pm25?.subIndexUsAqi).toBe(220);
    expect(pm25?.isDominant).toBe(true);
    expect(findDominantPollutant(assessments)).toBe("pm25");

    const boundaryExact = assessPollutants({
      pm25: 15,
      pm10: 45,
      no2: 25,
      o3: 100,
      so2: 40,
      co: 4000,
    });
    expect(boundaryExact.every((item) => !item.exceedsWho)).toBe(true);
    expect(findDominantPollutant(boundaryExact)).toBe("pm25");

    const o3Dominant = assessPollutants({ ...CLEAN_READINGS, o3: 220 });
    expect(findDominantPollutant(o3Dominant)).toBe("o3");

    const emptyDominant = findDominantPollutant([]);
    expect(emptyDominant).toBe("pm25");
  });

  it("detects severe winter smog and inversion traps from high particulate + NO2 signatures", () => {
    const exactlyWhoLimit = { pm25: 15, pm10: 45, no2: 25, o3: 50, so2: 10, co: 400 };
    expect(assessWinterSmog(100, exactlyWhoLimit)).toEqual({
      severity: "none",
      isWinterSmogAlert: false,
      inversionTrapLikely: false,
      primaryDrivers: [],
    });

    expect(assessWinterSmog(101, { ...CLEAN_READINGS, pm25: 16, pm10: 46, no2: 26 })).toEqual({
      severity: "elevated",
      isWinterSmogAlert: false,
      inversionTrapLikely: false,
      primaryDrivers: ["pm25", "pm10", "no2"],
    });
    expect(assessWinterSmog(90, { ...CLEAN_READINGS, pm25: 35.5 }).severity).toBe("elevated");

    expect(assessWinterSmog(151, { ...CLEAN_READINGS, pm25: 55.4, pm10: 154 })).toEqual({
      severity: "severe_smog",
      isWinterSmogAlert: true,
      inversionTrapLikely: false,
      primaryDrivers: ["pm25", "pm10"],
    });
    expect(assessWinterSmog(120, { ...CLEAN_READINGS, pm25: 55.5, no2: 49 })).toEqual({
      severity: "severe_smog",
      isWinterSmogAlert: true,
      inversionTrapLikely: false,
      primaryDrivers: ["pm25", "no2"],
    });
    expect(assessWinterSmog(120, { ...CLEAN_READINGS, pm10: 155 }).severity).toBe("severe_smog");

    const inversionBelow = assessWinterSmog(175, { ...CLEAN_READINGS, pm25: 55.5, no2: 79 });
    expect(inversionBelow.inversionTrapLikely).toBe(false);

    const inversionExact = assessWinterSmog(175, { ...CLEAN_READINGS, pm25: 55.5, no2: 80 });
    expect(inversionExact.inversionTrapLikely).toBe(true);

    expect(assessWinterSmog(201, CLEAN_READINGS).severity).toBe("smog_emergency");
    expect(assessWinterSmog(160, { ...CLEAN_READINGS, pm25: 125.5 }).severity).toBe(
      "smog_emergency",
    );
    expect(assessWinterSmog(200, { ...CLEAN_READINGS, pm25: 125.4 }).severity).toBe("severe_smog");
  });
});

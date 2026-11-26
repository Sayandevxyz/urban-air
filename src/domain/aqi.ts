import type {
  AqiCategory,
  EuropeanAqiBand,
  PollutantAssessment,
  PollutantKey,
  PollutantReadings,
  SmogAssessment,
  UsAqiClassification,
} from "@/domain/types";
import { WHO_GUIDELINES_2021_UG_M3, WINTER_SMOG_THRESHOLDS } from "@/lib/constants";

/**
 * Ordered list of supported urban air pollutants evaluated across dashboard and guidance.
 */
export const POLLUTANT_KEYS: readonly PollutantKey[] = [
  "pm25",
  "pm10",
  "no2",
  "o3",
  "so2",
  "co",
] as const;

interface BreakpointRow {
  readonly cLow: number;
  readonly cHigh: number;
  readonly iLow: number;
  readonly iHigh: number;
}

const PM25_BREAKPOINTS: readonly BreakpointRow[] = [
  { cLow: 0, cHigh: 9.0, iLow: 0, iHigh: 50 },
  { cLow: 9.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
  { cLow: 55.5, cHigh: 125.4, iLow: 151, iHigh: 200 },
  { cLow: 125.5, cHigh: 225.4, iLow: 201, iHigh: 300 },
  { cLow: 225.5, cHigh: 325.4, iLow: 301, iHigh: 400 },
  { cLow: 325.5, cHigh: 500.4, iLow: 401, iHigh: 500 },
];

const PM10_BREAKPOINTS: readonly BreakpointRow[] = [
  { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
  { cLow: 55, cHigh: 154, iLow: 51, iHigh: 100 },
  { cLow: 155, cHigh: 254, iLow: 101, iHigh: 150 },
  { cLow: 255, cHigh: 354, iLow: 151, iHigh: 200 },
  { cLow: 355, cHigh: 424, iLow: 201, iHigh: 300 },
  { cLow: 425, cHigh: 504, iLow: 301, iHigh: 400 },
  { cLow: 505, cHigh: 604, iLow: 401, iHigh: 500 },
];

const O3_BREAKPOINTS: readonly BreakpointRow[] = [
  { cLow: 0, cHigh: 108, iLow: 0, iHigh: 50 },
  { cLow: 109, cHigh: 140, iLow: 51, iHigh: 100 },
  { cLow: 141, cHigh: 170, iLow: 101, iHigh: 150 },
  { cLow: 171, cHigh: 210, iLow: 151, iHigh: 200 },
  { cLow: 211, cHigh: 400, iLow: 201, iHigh: 300 },
];

const NO2_BREAKPOINTS: readonly BreakpointRow[] = [
  { cLow: 0, cHigh: 100, iLow: 0, iHigh: 50 },
  { cLow: 101, cHigh: 188, iLow: 51, iHigh: 100 },
  { cLow: 189, cHigh: 677, iLow: 101, iHigh: 150 },
  { cLow: 678, cHigh: 1221, iLow: 151, iHigh: 200 },
  { cLow: 1222, cHigh: 2349, iLow: 201, iHigh: 300 },
];

const SO2_BREAKPOINTS: readonly BreakpointRow[] = [
  { cLow: 0, cHigh: 92, iLow: 0, iHigh: 50 },
  { cLow: 93, cHigh: 196, iLow: 51, iHigh: 100 },
  { cLow: 197, cHigh: 485, iLow: 101, iHigh: 150 },
  { cLow: 486, cHigh: 796, iLow: 151, iHigh: 200 },
  { cLow: 797, cHigh: 1582, iLow: 201, iHigh: 300 },
];

const CO_BREAKPOINTS: readonly BreakpointRow[] = [
  { cLow: 0, cHigh: 5000, iLow: 0, iHigh: 50 },
  { cLow: 5001, cHigh: 10800, iLow: 51, iHigh: 100 },
  { cLow: 10801, cHigh: 14200, iLow: 101, iHigh: 150 },
  { cLow: 14201, cHigh: 17600, iLow: 151, iHigh: 200 },
  { cLow: 17601, cHigh: 34800, iLow: 201, iHigh: 300 },
];

const BREAKPOINT_MAP: Readonly<
  Record<PollutantKey, { rows: readonly BreakpointRow[]; scale: number }>
> = {
  pm25: { rows: PM25_BREAKPOINTS, scale: 10 },
  pm10: { rows: PM10_BREAKPOINTS, scale: 1 },
  o3: { rows: O3_BREAKPOINTS, scale: 1 },
  no2: { rows: NO2_BREAKPOINTS, scale: 1 },
  so2: { rows: SO2_BREAKPOINTS, scale: 1 },
  co: { rows: CO_BREAKPOINTS, scale: 1 },
};

const MAX_US_AQI = 500;
const EAQI_BAND_UPPER_LIMITS: ReadonlyArray<{ max: number; band: EuropeanAqiBand }> = [
  { max: 20, band: "good" },
  { max: 40, band: "fair" },
  { max: 60, band: "moderate" },
  { max: 80, band: "poor" },
  { max: 100, band: "very_poor" },
];

const US_AQI_CLASSIFICATIONS: ReadonlyArray<{ max: number; meta: UsAqiClassification }> = [
  {
    max: 50,
    meta: {
      category: "good",
      severityRank: 1,
      iconId: "leaf",
      patternId: "solid",
      tokenName: "aqi-good",
    },
  },
  {
    max: 100,
    meta: {
      category: "moderate",
      severityRank: 2,
      iconId: "sun-cloud",
      patternId: "dots",
      tokenName: "aqi-moderate",
    },
  },
  {
    max: 150,
    meta: {
      category: "sensitive",
      severityRank: 3,
      iconId: "shield-alert",
      patternId: "diagonal",
      tokenName: "aqi-sensitive",
    },
  },
  {
    max: 200,
    meta: {
      category: "unhealthy",
      severityRank: 4,
      iconId: "mask-warning",
      patternId: "crosshatch",
      tokenName: "aqi-unhealthy",
    },
  },
  {
    max: 300,
    meta: {
      category: "very_unhealthy",
      severityRank: 5,
      iconId: "smog-danger",
      patternId: "grid",
      tokenName: "aqi-very-unhealthy",
    },
  },
];

function interpolateBreakpoint(
  valueUgM3: number,
  rows: readonly BreakpointRow[],
  scale: number,
): number {
  if (valueUgM3 <= 0) {
    return 0;
  }
  const truncated = Math.floor(valueUgM3 * scale) / scale;
  for (const row of rows) {
    if (truncated <= row.cHigh) {
      const ratio = (truncated - row.cLow) / (row.cHigh - row.cLow);
      return Math.round(row.iLow + ratio * (row.iHigh - row.iLow));
    }
  }
  return MAX_US_AQI;
}

/**
 * Computes the US EPA sub-index AQI (0-500) for a pollutant concentration in ug/m3.
 */
export function calculatePollutantUsAqi(key: PollutantKey, valueUgM3: number): number {
  const entry = BREAKPOINT_MAP[key];
  return interpolateBreakpoint(valueUgM3, entry.rows, entry.scale);
}

/**
 * Computes composite US AQI as the maximum sub-index across all six criteria pollutants.
 */
export function computeCompositeUsAqi(readings: PollutantReadings): number {
  let maxIndex = 0;
  for (const key of POLLUTANT_KEYS) {
    const subIndex = calculatePollutantUsAqi(key, readings[key]);
    if (subIndex > maxIndex) {
      maxIndex = subIndex;
    }
  }
  return maxIndex;
}

/**
 * Maps a numeric US AQI value to its semantic category, rank, icon, and non-color pattern.
 */
export function classifyUsAqi(usAqi: number): UsAqiClassification {
  for (const entry of US_AQI_CLASSIFICATIONS) {
    if (usAqi <= entry.max) {
      return entry.meta;
    }
  }
  return {
    category: "hazardous",
    severityRank: 6,
    iconId: "biohazard",
    patternId: "dense-bars",
    tokenName: "aqi-hazardous",
  };
}

/**
 * Maps a numeric European AQI (EAQI) score into its six standard EEA severity bands.
 */
export function computeEuropeanAqiBand(eaqiValue: number): EuropeanAqiBand {
  for (const entry of EAQI_BAND_UPPER_LIMITS) {
    if (eaqiValue <= entry.max) {
      return entry.band;
    }
  }
  return "extremely_poor";
}

/**
 * Estimates a European AQI value (0-120 scale) from pollutant concentrations when EAQI is omitted.
 */
export function estimateEuropeanAqiFromPollutants(readings: PollutantReadings): number {
  const pm25Score = Math.min(120, Math.round((readings.pm25 / 75) * 100));
  const pm10Score = Math.min(120, Math.round((readings.pm10 / 150) * 100));
  const no2Score = Math.min(120, Math.round((readings.no2 / 340) * 100));
  const o3Score = Math.min(120, Math.round((readings.o3 / 380) * 100));
  return Math.max(pm25Score, pm10Score, no2Score, o3Score);
}

/**
 * Evaluates all six pollutants against WHO 2021 guidelines and marks the dominant driver.
 */
export function assessPollutants(readings: PollutantReadings): readonly PollutantAssessment[] {
  let highestSubIndex = -1;
  let dominantKey: PollutantKey = "pm25";

  const subIndices: Record<PollutantKey, number> = {
    pm25: calculatePollutantUsAqi("pm25", readings.pm25),
    pm10: calculatePollutantUsAqi("pm10", readings.pm10),
    no2: calculatePollutantUsAqi("no2", readings.no2),
    o3: calculatePollutantUsAqi("o3", readings.o3),
    so2: calculatePollutantUsAqi("so2", readings.so2),
    co: calculatePollutantUsAqi("co", readings.co),
  };

  for (const key of POLLUTANT_KEYS) {
    if (subIndices[key] > highestSubIndex) {
      highestSubIndex = subIndices[key];
      dominantKey = key;
    }
  }

  return POLLUTANT_KEYS.map((key) => {
    const valueUgM3 = readings[key];
    const whoGuidelineUgM3 = WHO_GUIDELINES_2021_UG_M3[key];
    const whoRatio = Math.round((valueUgM3 / whoGuidelineUgM3) * 10) / 10;
    return {
      key,
      valueUgM3,
      whoGuidelineUgM3,
      whoRatio,
      exceedsWho: valueUgM3 > whoGuidelineUgM3,
      subIndexUsAqi: subIndices[key],
      isDominant: key === dominantKey,
    };
  });
}

/**
 * Returns the dominant pollutant key from an evaluated pollutant assessment list.
 */
export function findDominantPollutant(assessments: readonly PollutantAssessment[]): PollutantKey {
  const dominant = assessments.find((item) => item.isDominant);
  return dominant ? dominant.key : "pm25";
}

/**
 * Detects severe winter smog and urban inversion episodes from AQI and particulate/NO2 drivers.
 */
export function assessWinterSmog(usAqi: number, readings: PollutantReadings): SmogAssessment {
  const primaryDrivers: PollutantKey[] = [];
  if (readings.pm25 > WHO_GUIDELINES_2021_UG_M3.pm25) {
    primaryDrivers.push("pm25");
  }
  if (readings.pm10 > WHO_GUIDELINES_2021_UG_M3.pm10) {
    primaryDrivers.push("pm10");
  }
  if (readings.no2 > WHO_GUIDELINES_2021_UG_M3.no2) {
    primaryDrivers.push("no2");
  }

  const inversionTrapLikely =
    readings.pm25 >= WINTER_SMOG_THRESHOLDS.pm25SevereUgM3 &&
    readings.no2 >= WINTER_SMOG_THRESHOLDS.no2ElevatedUgM3;

  const severity = resolveSmogSeverity(usAqi, readings);
  return {
    severity,
    isWinterSmogAlert: severity === "severe_smog" || severity === "smog_emergency",
    inversionTrapLikely,
    primaryDrivers,
  };
}

function resolveSmogSeverity(
  usAqi: number,
  readings: PollutantReadings,
): SmogAssessment["severity"] {
  if (usAqi >= WINTER_SMOG_THRESHOLDS.usAqiEmergency || readings.pm25 >= 125.5) {
    return "smog_emergency";
  }
  if (
    usAqi >= WINTER_SMOG_THRESHOLDS.usAqiSevere ||
    readings.pm25 >= WINTER_SMOG_THRESHOLDS.pm25SevereUgM3 ||
    readings.pm10 >= WINTER_SMOG_THRESHOLDS.pm10SevereUgM3
  ) {
    return "severe_smog";
  }
  if (usAqi >= 101 || readings.pm25 >= 35.5) {
    return "elevated";
  }
  return "none";
}

export type { AqiCategory };

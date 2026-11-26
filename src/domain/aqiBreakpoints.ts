import type { PollutantKey, PollutantReadings } from "@/domain/types";

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
const MAX_EAQI_ESTIMATE = 120;

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
 * Estimates a European AQI value (0-120 scale) from pollutant concentrations when EAQI is omitted.
 */
export function estimateEuropeanAqiFromPollutants(readings: PollutantReadings): number {
  const pm25Score = Math.min(MAX_EAQI_ESTIMATE, Math.round((readings.pm25 / 75) * 100));
  const pm10Score = Math.min(MAX_EAQI_ESTIMATE, Math.round((readings.pm10 / 150) * 100));
  const no2Score = Math.min(MAX_EAQI_ESTIMATE, Math.round((readings.no2 / 340) * 100));
  const o3Score = Math.min(MAX_EAQI_ESTIMATE, Math.round((readings.o3 / 380) * 100));
  return Math.max(pm25Score, pm10Score, no2Score, o3Score);
}

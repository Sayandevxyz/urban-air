import { calculatePollutantUsAqi, POLLUTANT_KEYS } from "@/domain/aqiBreakpoints";
import { WHO_GUIDELINES_2021_UG_M3, WINTER_SMOG_THRESHOLDS } from "@/lib/constants";
import type {
  EuropeanAqiBand,
  PollutantAssessment,
  PollutantKey,
  PollutantReadings,
  SmogAssessment,
  UsAqiClassification,
} from "@/types/air-quality";

const ELEVATED_SMOG_US_AQI = 101;
const ELEVATED_SMOG_PM25 = 35.5;
const EMERGENCY_SMOG_PM25 = 125.5;

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
 * Evaluates all six pollutants against WHO 2021 guidelines and marks the dominant driver.
 */
export function assessPollutants(readings: PollutantReadings): readonly PollutantAssessment[] {
  const subIndices: Record<PollutantKey, number> = {
    pm25: calculatePollutantUsAqi("pm25", readings.pm25),
    pm10: calculatePollutantUsAqi("pm10", readings.pm10),
    no2: calculatePollutantUsAqi("no2", readings.no2),
    o3: calculatePollutantUsAqi("o3", readings.o3),
    so2: calculatePollutantUsAqi("so2", readings.so2),
    co: calculatePollutantUsAqi("co", readings.co),
  };

  let dominantKey: PollutantKey = "pm25";
  let highestSubIndex = -1;
  for (const key of POLLUTANT_KEYS) {
    if (subIndices[key] > highestSubIndex) {
      highestSubIndex = subIndices[key];
      dominantKey = key;
    }
  }

  return POLLUTANT_KEYS.map((key) => {
    const valueUgM3 = readings[key];
    const whoGuidelineUgM3 = WHO_GUIDELINES_2021_UG_M3[key];
    return {
      key,
      valueUgM3,
      whoGuidelineUgM3,
      whoRatio: Math.round((valueUgM3 / whoGuidelineUgM3) * 10) / 10,
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

function collectSmogDrivers(readings: PollutantReadings): readonly PollutantKey[] {
  const drivers: PollutantKey[] = [];
  if (readings.pm25 > WHO_GUIDELINES_2021_UG_M3.pm25) drivers.push("pm25");
  if (readings.pm10 > WHO_GUIDELINES_2021_UG_M3.pm10) drivers.push("pm10");
  if (readings.no2 > WHO_GUIDELINES_2021_UG_M3.no2) drivers.push("no2");
  return drivers;
}

function resolveSmogSeverity(
  usAqi: number,
  readings: PollutantReadings,
): SmogAssessment["severity"] {
  if (usAqi >= WINTER_SMOG_THRESHOLDS.usAqiEmergency || readings.pm25 >= EMERGENCY_SMOG_PM25) {
    return "smog_emergency";
  }
  const hasSevereParticulate =
    readings.pm25 >= WINTER_SMOG_THRESHOLDS.pm25SevereUgM3 ||
    readings.pm10 >= WINTER_SMOG_THRESHOLDS.pm10SevereUgM3;
  if (usAqi >= WINTER_SMOG_THRESHOLDS.usAqiSevere || hasSevereParticulate) {
    return "severe_smog";
  }
  if (usAqi >= ELEVATED_SMOG_US_AQI || readings.pm25 >= ELEVATED_SMOG_PM25) {
    return "elevated";
  }
  return "none";
}

/**
 * Detects severe winter smog and urban inversion episodes from AQI and particulate/NO2 drivers.
 */
export function assessWinterSmog(usAqi: number, readings: PollutantReadings): SmogAssessment {
  const severity = resolveSmogSeverity(usAqi, readings);
  const inversionTrapLikely =
    readings.pm25 >= WINTER_SMOG_THRESHOLDS.pm25SevereUgM3 &&
    readings.no2 >= WINTER_SMOG_THRESHOLDS.no2ElevatedUgM3;
  return {
    severity,
    isWinterSmogAlert: severity === "severe_smog" || severity === "smog_emergency",
    inversionTrapLikely,
    primaryDrivers: collectSmogDrivers(readings),
  };
}

// ============================================================================
// src/domain/planner.ts
// Computes transparent O(n) activity window scores from forecast air telemetry.
// ============================================================================

import {
  assessPollutants,
  assessWinterSmog,
  classifyUsAqi,
  findDominantPollutant,
} from "@/domain/aqi";
import {
  DECIMAL_RADIX,
  ISO_SLICE,
  PLANNER_HOURS_WINDOW,
  WHO_GUIDELINES_2021_UG_M3,
} from "@/lib/constants";
import type { AirQualityReport, HourlyForecastPoint } from "@/types/air-quality";
import type {
  ActivityPlanResult,
  ActivityScorePoint,
  ActivityType,
  PersonaId,
} from "@/types/guidance";

const DEFAULT_FALLBACK_HOUR = 12;
const VENTILATE_DAY_START_HOUR = 11;
const VENTILATE_DAY_END_HOUR = 16;
const VENTILATE_EARLY_END_HOUR = 6;
const VENTILATE_NIGHT_START_HOUR = 21;
const VENTILATE_DAY_BONUS = 8;
const VENTILATE_NIGHT_PENALTY = -6;
const ACTIVE_DAY_START_HOUR = 7;
const ACTIVE_DAY_END_HOUR = 19;
const ACTIVE_DAY_BONUS = 6;
const ACTIVE_NIGHT_PENALTY = -4;
const MAX_AQI_PENALTY = 75;
const AQI_PENALTY_WEIGHT = 0.42;
const PM25_PENALTY_WEIGHT = 4;
const O3_PENALTY_WEIGHT = 6;
const MAX_POLLUTANT_PENALTY = 25;
const BASE_SCORE = 100;

const ACTIVITY_INTENSITY_MULTIPLIER: Readonly<Record<ActivityType, number>> = {
  run: 1.35,
  cycle: 1.25,
  walk: 1.0,
  ventilate: 0.85,
};

const PERSONA_SENSITIVITY_FACTOR: Readonly<Record<PersonaId, number>> = {
  general: 1.0,
  children: 1.2,
  elderly: 1.2,
  asthma: 1.25,
  pregnant: 1.2,
  athlete: 1.1,
  worker: 1.1,
};

function parseHourFromIso(timeIso: string): number {
  const hourSlice = timeIso.slice(ISO_SLICE.hourStart, ISO_SLICE.hourEnd);
  const parsed = Number.parseInt(hourSlice, DECIMAL_RADIX);
  return Number.isNaN(parsed) ? DEFAULT_FALLBACK_HOUR : parsed;
}

function computeTimeSuitabilityBonus(activity: ActivityType, hour: number): number {
  if (activity === "ventilate") {
    if (hour >= VENTILATE_DAY_START_HOUR && hour <= VENTILATE_DAY_END_HOUR) {
      return VENTILATE_DAY_BONUS;
    }
    return hour <= VENTILATE_EARLY_END_HOUR || hour >= VENTILATE_NIGHT_START_HOUR
      ? VENTILATE_NIGHT_PENALTY
      : 0;
  }
  return hour >= ACTIVE_DAY_START_HOUR && hour <= ACTIVE_DAY_END_HOUR
    ? ACTIVE_DAY_BONUS
    : ACTIVE_NIGHT_PENALTY;
}

function scoreSingleHour(
  point: HourlyForecastPoint,
  activity: ActivityType,
  persona: PersonaId,
): ActivityScorePoint {
  const intensity = ACTIVITY_INTENSITY_MULTIPLIER[activity];
  const sensitivity = PERSONA_SENSITIVITY_FACTOR[persona];
  const aqiPenalty = Math.min(
    MAX_AQI_PENALTY,
    Math.round(point.usAqi * AQI_PENALTY_WEIGHT * intensity * sensitivity),
  );
  const pm25RatioPenalty = (point.pm25 / WHO_GUIDELINES_2021_UG_M3.pm25) * PM25_PENALTY_WEIGHT;
  const o3RatioPenalty = (point.o3 / WHO_GUIDELINES_2021_UG_M3.o3) * O3_PENALTY_WEIGHT;
  const pollutantPenalty = Math.min(
    MAX_POLLUTANT_PENALTY,
    Math.round(pm25RatioPenalty + o3RatioPenalty),
  );
  const timeSuitabilityBonus = computeTimeSuitabilityBonus(
    activity,
    parseHourFromIso(point.timeIso),
  );
  const rawScore = BASE_SCORE - aqiPenalty - pollutantPenalty + timeSuitabilityBonus;
  const score = Math.max(0, Math.min(BASE_SCORE, rawScore));

  return {
    timeIso: point.timeIso,
    score,
    usAqi: point.usAqi,
    pm25: point.pm25,
    o3: point.o3,
    aqiPenalty,
    pollutantPenalty,
    timeSuitabilityBonus,
  };
}

/** Scores forecast hours in one O(n) pass to find the best and worst outdoor/ventilation windows. */
export function scoreActivityWindows(
  hourly: readonly HourlyForecastPoint[],
  activity: ActivityType,
  persona: PersonaId,
  windowHours = PLANNER_HOURS_WINDOW,
): ActivityPlanResult {
  const timeline: ActivityScorePoint[] = [];
  let bestWindow: ActivityScorePoint | undefined;
  let worstWindow: ActivityScorePoint | undefined;

  for (const point of hourly) {
    if (timeline.length >= windowHours) {
      break;
    }
    const scored = scoreSingleHour(point, activity, persona);
    timeline.push(scored);

    if (!bestWindow || scored.score > bestWindow.score) {
      bestWindow = scored;
    }
    if (!worstWindow || scored.score < worstWindow.score) {
      worstWindow = scored;
    }
  }

  return { activity, persona, bestWindow, worstWindow, timeline };
}

/** Summarizes key AQI category, pollutant, smog, and best walk hour metrics for city comparisons. */
export function summarizeCityComparison(report: AirQualityReport) {
  const usMeta = classifyUsAqi(report.current.usAqi);
  const dominant = findDominantPollutant(assessPollutants(report.current.readings));
  const smog = assessWinterSmog(report.current.usAqi, report.current.readings);
  const best = scoreActivityWindows(report.hourly, "walk", "general").bestWindow;
  return {
    usCategory: usMeta.category,
    dominant,
    smogSeverity: smog.severity,
    bestLabel: best ? `${best.timeIso.slice(ISO_SLICE.hourStart, ISO_SLICE.minuteEnd)} UTC` : "—",
  };
}

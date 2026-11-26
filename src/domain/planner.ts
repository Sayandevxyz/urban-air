import type {
  ActivityPlanResult,
  ActivityScorePoint,
  ActivityType,
  HourlyForecastPoint,
  PersonaId,
} from "@/domain/types";
import { PLANNER_HOURS_WINDOW, WHO_GUIDELINES_2021_UG_M3 } from "@/lib/constants";

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
  const hourSlice = timeIso.slice(11, 13);
  const parsed = Number.parseInt(hourSlice, 10);
  return Number.isNaN(parsed) ? 12 : parsed;
}

function computeTimeSuitabilityBonus(activity: ActivityType, hour: number): number {
  if (activity === "ventilate") {
    return hour >= 11 && hour <= 16 ? 8 : hour <= 6 || hour >= 21 ? -6 : 0;
  }
  return hour >= 7 && hour <= 19 ? 6 : -4;
}

function scoreSingleHour(
  point: HourlyForecastPoint,
  activity: ActivityType,
  persona: PersonaId,
): ActivityScorePoint {
  const intensity = ACTIVITY_INTENSITY_MULTIPLIER[activity];
  const sensitivity = PERSONA_SENSITIVITY_FACTOR[persona];
  const aqiPenalty = Math.min(75, Math.round(point.usAqi * 0.42 * intensity * sensitivity));
  const pm25RatioPenalty = (point.pm25 / WHO_GUIDELINES_2021_UG_M3.pm25) * 4;
  const o3RatioPenalty = (point.o3 / WHO_GUIDELINES_2021_UG_M3.o3) * 6;
  const pollutantPenalty = Math.min(25, Math.round(pm25RatioPenalty + o3RatioPenalty));
  const timeSuitabilityBonus = computeTimeSuitabilityBonus(
    activity,
    parseHourFromIso(point.timeIso),
  );
  const rawScore = 100 - aqiPenalty - pollutantPenalty + timeSuitabilityBonus;
  const score = Math.max(0, Math.min(100, rawScore));

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

/**
 * Scores forecast hours in a single O(n) pass to find the safest and riskiest windows
 * for running, cycling, walking, or ventilating indoors.
 * Time complexity: O(n) where n = min(hourly.length, windowHours). Space complexity: O(n).
 */
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

  return {
    activity,
    persona,
    bestWindow,
    worstWindow,
    timeline,
  };
}

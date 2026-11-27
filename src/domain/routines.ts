// ============================================================================
// src/domain/routines.ts
// Recommends low-emission daily routines tailored to pollution and lifestyle.
// ============================================================================

import { US_AQI_TIER_THRESHOLDS } from "@/lib/constants";
import type { PollutantReadings, SmogAssessment } from "@/types/air-quality";
import type { ResidentProfile, RoutineAlternative } from "@/types/guidance";

const TRAFFIC_HIGH_NO2_UG_M3 = 60;

/** Input contract used to build low-emission daily routine alternatives. */
export interface RoutinesInput {
  readonly usAqi: number;
  readonly smog: SmogAssessment;
  readonly readings: PollutantReadings;
  readonly profile: ResidentProfile;
  readonly bestWindowHourIso: string | undefined;
}

function collectCommuteRoutines(input: RoutinesInput): RoutineAlternative[] {
  const { profile, smog, readings, bestWindowHourIso } = input;
  const list: RoutineAlternative[] = [];
  if (profile.commuteMode === "car" || profile.commuteMode === "two_wheeler") {
    list.push({
      id: "shift_to_transit_or_active",
      category: "commute",
      priority:
        smog.isWinterSmogAlert || readings.no2 >= TRAFFIC_HIGH_NO2_UG_M3 ? "high" : "medium",
      suggestedHourIso: bestWindowHourIso,
    });
  }
  if (smog.inversionTrapLikely || smog.isWinterSmogAlert) {
    list.push(
      {
        id: "avoid_morning_smog_commute",
        category: "schedule",
        priority: "high",
        suggestedHourIso: bestWindowHourIso,
      },
      {
        id: "remote_work_or_carpool",
        category: "commute",
        priority: "high",
        suggestedHourIso: undefined,
      },
    );
  } else {
    list.push({
      id: "bundle_errands_clean_window",
      category: "schedule",
      priority: "medium",
      suggestedHourIso: bestWindowHourIso,
    });
  }
  return list;
}

/** Recommends low-emission daily routines tailored to local pollution, commute, and energy setup. */
export function buildRoutinesAndAlternatives(input: RoutinesInput): readonly RoutineAlternative[] {
  const routines = collectCommuteRoutines(input);
  const isElevatedAqi = input.usAqi >= US_AQI_TIER_THRESHOLDS.sensitive;
  if (input.profile.homeEnergyMode === "gas_biomass") {
    routines.push({
      id: "clean_cooking_switch",
      category: "home",
      priority: isElevatedAqi ? "high" : "medium",
      suggestedHourIso: undefined,
    });
  }
  routines.push({
    id: "outdoor_exercise_reschedule",
    category: "exercise",
    priority: isElevatedAqi ? "high" : "medium",
    suggestedHourIso: input.bestWindowHourIso,
  });
  return routines;
}

import type {
  PollutantReadings,
  ResidentProfile,
  RoutineAlternative,
  SmogAssessment,
} from "@/domain/types";

/**
 * Recommends low-emission daily routines and sustainable alternatives tailored to
 * the resident's local pollution profile, commute mode, and home energy setup.
 */
export function buildRoutinesAndAlternatives(
  usAqi: number,
  smog: SmogAssessment,
  readings: PollutantReadings,
  profile: ResidentProfile,
  bestWindowHourIso: string | undefined,
): readonly RoutineAlternative[] {
  const routines: RoutineAlternative[] = [];

  if (profile.commuteMode === "car" || profile.commuteMode === "two_wheeler") {
    routines.push({
      id: "shift_to_transit_or_active",
      category: "commute",
      priority: smog.isWinterSmogAlert || readings.no2 >= 60 ? "high" : "medium",
      suggestedHourIso: bestWindowHourIso,
    });
  }

  if (smog.inversionTrapLikely || smog.isWinterSmogAlert) {
    routines.push({
      id: "avoid_morning_smog_commute",
      category: "schedule",
      priority: "high",
      suggestedHourIso: bestWindowHourIso,
    });
    routines.push({
      id: "remote_work_or_carpool",
      category: "commute",
      priority: "high",
      suggestedHourIso: undefined,
    });
  } else {
    routines.push({
      id: "bundle_errands_clean_window",
      category: "schedule",
      priority: "medium",
      suggestedHourIso: bestWindowHourIso,
    });
  }

  if (profile.homeEnergyMode === "gas_biomass") {
    routines.push({
      id: "clean_cooking_switch",
      category: "home",
      priority: usAqi >= 101 ? "high" : "medium",
      suggestedHourIso: undefined,
    });
  }

  routines.push({
    id: "outdoor_exercise_reschedule",
    category: "exercise",
    priority: usAqi >= 101 ? "high" : "medium",
    suggestedHourIso: bestWindowHourIso,
  });

  return routines;
}

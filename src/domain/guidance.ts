import type {
  HourlyForecastPoint,
  IndoorAirHack,
  MaskAdviceKey,
  OutdoorAdviceKey,
  PersonaGuidance,
  PersonaId,
  PollutantReadings,
  ResidentProfile,
  SmogAssessment,
  WindowsAdviceKey,
} from "@/domain/types";

const HIGH_SENSITIVITY_PERSONAS = new Set<PersonaId>(["children", "elderly", "asthma", "pregnant"]);

function findCleanestWindowIso(hourly: readonly HourlyForecastPoint[]): string | undefined {
  let best: HourlyForecastPoint | undefined;
  for (const point of hourly) {
    if (!best || point.usAqi < best.usAqi) {
      best = point;
    }
  }
  return best?.timeIso;
}

function resolveMaskAdvice(usAqi: number, isSensitivePersona: boolean): MaskAdviceKey {
  if (usAqi >= 151) {
    return "n95_required";
  }
  if (usAqi >= 101) {
    return "n95_recommended";
  }
  if (usAqi >= 51 && isSensitivePersona) {
    return "optional_sensitive";
  }
  return "none_needed";
}

function resolveWindowsAdvice(usAqi: number, smog: SmogAssessment): WindowsAdviceKey {
  if (smog.isWinterSmogAlert || usAqi >= 151) {
    return "keep_sealed";
  }
  if (usAqi >= 51) {
    return "brief_clean_window";
  }
  return "open_cross_ventilation";
}

function resolveOutdoorAdvice(usAqi: number, isSensitivePersona: boolean): OutdoorAdviceKey {
  if (usAqi >= 201) {
    return "avoid_outdoors";
  }
  if (usAqi >= 151) {
    return isSensitivePersona ? "avoid_outdoors" : "shift_indoors";
  }
  if (usAqi >= 101) {
    return isSensitivePersona ? "shift_indoors" : "pace_outdoors";
  }
  return "normal_outdoor";
}

/**
 * Generates personalized mask, window ventilation, and activity advice tailored to persona and smog risk.
 */
export function buildPersonaGuidance(
  usAqi: number,
  smog: SmogAssessment,
  readings: PollutantReadings,
  profile: ResidentProfile,
  hourly: readonly HourlyForecastPoint[],
): PersonaGuidance {
  const isSensitivePersona = HIGH_SENSITIVITY_PERSONAS.has(profile.persona);
  const maskAdvice = resolveMaskAdvice(usAqi, isSensitivePersona);
  const windowsAdvice = resolveWindowsAdvice(usAqi, smog);
  const outdoorAdvice = resolveOutdoorAdvice(usAqi, isSensitivePersona);
  const recommendedWindowIso = findCleanestWindowIso(hourly);

  const checklistKeys: string[] = [];
  if (smog.isWinterSmogAlert) {
    checklistKeys.push("smog_check_seal", "smog_n95_fit");
  }
  if (isSensitivePersona && usAqi >= 101) {
    checklistKeys.push("sensitive_keep_reliever_ready");
  }
  if (readings.o3 >= 100) {
    checklistKeys.push("ozone_avoid_afternoon_peak");
  }
  checklistKeys.push("hydrate_and_monitor");

  return {
    persona: profile.persona,
    maskAdvice,
    windowsAdvice,
    outdoorAdvice,
    recommendedWindowIso,
    highSensitivityWarning: isSensitivePersona ? usAqi >= 101 : usAqi >= 151,
    checklistKeys,
  };
}

/**
 * Selects prioritized indoor air quality hacks matching outdoor smog severity and home setup.
 */
export function buildIndoorAirHacks(
  usAqi: number,
  smog: SmogAssessment,
  readings: PollutantReadings,
  profile: ResidentProfile,
): readonly IndoorAirHack[] {
  const hacks: IndoorAirHack[] = [];

  if (smog.isWinterSmogAlert || usAqi >= 151) {
    hacks.push({ id: "seal_smog_drafts", priority: "critical" });
  } else {
    hacks.push({ id: "timed_window_purge", priority: "standard" });
  }

  if (profile.filtrationMode === "hepa") {
    hacks.push({ id: "run_hepa_filtration", priority: usAqi >= 101 ? "critical" : "high" });
  } else {
    hacks.push({
      id: "build_diy_box_filter",
      priority: usAqi >= 151 ? "critical" : "high",
    });
  }

  if (profile.homeEnergyMode === "gas_biomass" || readings.no2 >= 40) {
    hacks.push({ id: "exhaust_or_induction_cook", priority: "high" });
  }

  hacks.push({ id: "wet_mop_dust", priority: "standard" });
  hacks.push({ id: "stop_indoor_combustion", priority: usAqi >= 101 ? "high" : "standard" });

  return hacks;
}

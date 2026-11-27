// ============================================================================
// src/domain/guidance.ts
// Generates personalized health advice and indoor hacks by persona and smog.
// ============================================================================

import { US_AQI_TIER_THRESHOLDS, WHO_GUIDELINES_2021_UG_M3 } from "@/lib/constants";
import type { HourlyForecastPoint, PollutantReadings, SmogAssessment } from "@/types/air-quality";
import type {
  IndoorAirHack,
  MaskAdviceKey,
  OutdoorAdviceKey,
  PersonaGuidance,
  PersonaId,
  ResidentProfile,
  WindowsAdviceKey,
} from "@/types/guidance";

const HIGH_NO2_COOKING_THRESHOLD_UG_M3 = 40;
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
  if (usAqi >= US_AQI_TIER_THRESHOLDS.unhealthy) return "n95_required";
  if (usAqi >= US_AQI_TIER_THRESHOLDS.sensitive) return "n95_recommended";
  if (usAqi >= US_AQI_TIER_THRESHOLDS.moderate && isSensitivePersona) return "optional_sensitive";
  return "none_needed";
}

function resolveWindowsAdvice(usAqi: number, smog: SmogAssessment): WindowsAdviceKey {
  if (smog.isWinterSmogAlert || usAqi >= US_AQI_TIER_THRESHOLDS.unhealthy) {
    return "keep_sealed";
  }
  if (usAqi >= US_AQI_TIER_THRESHOLDS.moderate) {
    return "brief_clean_window";
  }
  return "open_cross_ventilation";
}

function resolveOutdoorAdvice(usAqi: number, isSensitivePersona: boolean): OutdoorAdviceKey {
  if (usAqi >= US_AQI_TIER_THRESHOLDS.veryUnhealthy) {
    return "avoid_outdoors";
  }
  if (usAqi >= US_AQI_TIER_THRESHOLDS.unhealthy) {
    return isSensitivePersona ? "avoid_outdoors" : "shift_indoors";
  }
  if (usAqi >= US_AQI_TIER_THRESHOLDS.sensitive) {
    return isSensitivePersona ? "shift_indoors" : "pace_outdoors";
  }
  return "normal_outdoor";
}

/** Input contract passed to the personalized health guidance builder. */
export interface PersonaGuidanceInput {
  readonly usAqi: number;
  readonly smog: SmogAssessment;
  readonly readings: PollutantReadings;
  readonly profile: ResidentProfile;
  readonly hourly: readonly HourlyForecastPoint[];
}

/** Generates personalized mask, window ventilation, and activity advice per persona and smog level. */
export function buildPersonaGuidance({
  usAqi,
  smog,
  readings,
  profile,
  hourly,
}: PersonaGuidanceInput): PersonaGuidance {
  const isSensitivePersona = HIGH_SENSITIVITY_PERSONAS.has(profile.persona);
  const maskAdvice = resolveMaskAdvice(usAqi, isSensitivePersona);
  const windowsAdvice = resolveWindowsAdvice(usAqi, smog);
  const outdoorAdvice = resolveOutdoorAdvice(usAqi, isSensitivePersona);
  const recommendedWindowIso = findCleanestWindowIso(hourly);

  const checklistKeys: string[] = [];
  if (smog.isWinterSmogAlert) {
    checklistKeys.push("smog_check_seal", "smog_n95_fit");
  }
  if (isSensitivePersona && usAqi >= US_AQI_TIER_THRESHOLDS.sensitive) {
    checklistKeys.push("sensitive_keep_reliever_ready");
  }
  if (readings.o3 >= WHO_GUIDELINES_2021_UG_M3.o3) {
    checklistKeys.push("ozone_avoid_afternoon_peak");
  }
  checklistKeys.push("hydrate_and_monitor");

  return {
    persona: profile.persona,
    maskAdvice,
    windowsAdvice,
    outdoorAdvice,
    recommendedWindowIso,
    highSensitivityWarning: isSensitivePersona
      ? usAqi >= US_AQI_TIER_THRESHOLDS.sensitive
      : usAqi >= US_AQI_TIER_THRESHOLDS.unhealthy,
    checklistKeys,
  };
}

/** Selects prioritized indoor air quality hacks matching outdoor smog severity and home setup. */
export function buildIndoorAirHacks(
  usAqi: number,
  smog: SmogAssessment,
  readings: PollutantReadings,
  profile: ResidentProfile,
): readonly IndoorAirHack[] {
  const hacks: IndoorAirHack[] = [];

  if (smog.isWinterSmogAlert || usAqi >= US_AQI_TIER_THRESHOLDS.unhealthy) {
    hacks.push({ id: "seal_smog_drafts", priority: "critical" });
  } else {
    hacks.push({ id: "timed_window_purge", priority: "standard" });
  }

  if (profile.filtrationMode === "hepa") {
    hacks.push({
      id: "run_hepa_filtration",
      priority: usAqi >= US_AQI_TIER_THRESHOLDS.sensitive ? "critical" : "high",
    });
  } else {
    hacks.push({
      id: "build_diy_box_filter",
      priority: usAqi >= US_AQI_TIER_THRESHOLDS.unhealthy ? "critical" : "high",
    });
  }

  if (
    profile.homeEnergyMode === "gas_biomass" ||
    readings.no2 >= HIGH_NO2_COOKING_THRESHOLD_UG_M3
  ) {
    hacks.push({ id: "exhaust_or_induction_cook", priority: "high" });
  }

  hacks.push({ id: "wet_mop_dust", priority: "standard" });
  hacks.push({
    id: "stop_indoor_combustion",
    priority: usAqi >= US_AQI_TIER_THRESHOLDS.sensitive ? "high" : "standard",
  });

  return hacks;
}

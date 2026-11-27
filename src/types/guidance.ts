// ============================================================================
// src/types/guidance.ts
// Defines resident profiles, guidance outputs, routines, planner, and alerts.
// ============================================================================

/** Resident sensitivity persona used to tailor mask, window, and activity limits. */
export type PersonaId =
  "general" | "children" | "elderly" | "asthma" | "pregnant" | "athlete" | "worker";

/** Primary daily commute mode used in routine recommendations and CO2/NOx math. */
export type CommuteMode = "car" | "transit" | "two_wheeler" | "walk_cycle";

/** Primary household cooking and heating fuel affecting indoor PM2.5 and NO2. */
export type HomeEnergyMode = "gas_biomass" | "electric_induction";

/** Existing indoor filtration setup determining priority HEPA vs DIY box-fan hacks. */
export type FiltrationMode = "none" | "hepa" | "diy_box_fan";

/** Supported outdoor activity or ventilation window evaluated by the planner. */
export type ActivityType = "run" | "cycle" | "walk" | "ventilate";

/** Resident lifestyle and household configuration tailoring guidance and impact. */
export interface ResidentProfile {
  readonly persona: PersonaId;
  readonly commuteMode: CommuteMode;
  readonly homeEnergyMode: HomeEnergyMode;
  readonly filtrationMode: FiltrationMode;
}

/** Translation key union selecting mask protection advice. */
export type MaskAdviceKey =
  "none_needed" | "optional_sensitive" | "n95_recommended" | "n95_required";

/** Translation key union selecting window ventilation advice. */
export type WindowsAdviceKey = "open_cross_ventilation" | "brief_clean_window" | "keep_sealed";

/** Translation key union selecting outdoor activity pacing limits. */
export type OutdoorAdviceKey =
  "normal_outdoor" | "pace_outdoors" | "shift_indoors" | "avoid_outdoors";

/** Tailored protection plan combining mask, window, activity, and checklist keys. */
export interface PersonaGuidance {
  readonly persona: PersonaId;
  readonly maskAdvice: MaskAdviceKey;
  readonly windowsAdvice: WindowsAdviceKey;
  readonly outdoorAdvice: OutdoorAdviceKey;
  readonly recommendedWindowIso: string | undefined;
  readonly highSensitivityWarning: boolean;
  readonly checklistKeys: readonly string[];
}

/** Prioritized indoor air quality mitigation action tailored to home energy/filters. */
export interface IndoorAirHack {
  readonly id:
    | "seal_smog_drafts"
    | "run_hepa_filtration"
    | "build_diy_box_filter"
    | "wet_mop_dust"
    | "exhaust_or_induction_cook"
    | "stop_indoor_combustion"
    | "timed_window_purge";
  readonly priority: "critical" | "high" | "standard";
}

/** Low-emission daily routine recommendation tailored to smog and lifestyle. */
export interface RoutineAlternative {
  readonly id:
    | "shift_to_transit_or_active"
    | "avoid_morning_smog_commute"
    | "bundle_errands_clean_window"
    | "clean_cooking_switch"
    | "remote_work_or_carpool"
    | "outdoor_exercise_reschedule";
  readonly category: "commute" | "home" | "schedule" | "exercise";
  readonly priority: "high" | "medium";
  readonly suggestedHourIso: string | undefined;
}

/** Interactive toggle and duration inputs modeled by the direct impact calculator. */
export interface ImpactChoiceInput {
  readonly commuteDistanceKm: number;
  readonly swapCarToCleanTransit: boolean;
  readonly shiftActivityToBestWindow: boolean;
  readonly wearFittedN95Outdoors: boolean;
  readonly useCleanCookingAndExhaust: boolean;
  readonly runIndoorAirFiltration: boolean;
  readonly outdoorHours: number;
  readonly bestWindowPm25UgM3: number;
}

/** Single action's contribution to PM2.5 inhalation avoidance and emissions savings. */
export interface ImpactBreakdownItem {
  readonly id:
    | "commute_emissions"
    | "timing_exposure"
    | "mask_protection"
    | "indoor_filtration"
    | "clean_cooking";
  readonly pm25AvoidedUg: number;
  readonly co2SavedGrams: number;
  readonly noxSavedGrams: number;
}

/** Quantified personal exposure reduction and community emissions impact summary. */
export interface DirectImpactResult {
  readonly personalPm25AvoidedUg: number;
  readonly baselineOutdoorPm25InhaledUg: number;
  readonly personalReductionPercent: number;
  readonly communityCo2SavedGrams: number;
  readonly communityNoxSavedGrams: number;
  readonly breakdown: readonly ImpactBreakdownItem[];
}

/** Hourly planner suitability score (0-100) with transparent penalty breakdown. */
export interface ActivityScorePoint {
  readonly timeIso: string;
  readonly score: number;
  readonly usAqi: number;
  readonly pm25: number;
  readonly o3: number;
  readonly aqiPenalty: number;
  readonly pollutantPenalty: number;
  readonly timeSuitabilityBonus: number;
}

/** Best/worst window recommendation and hourly score timeline from planner scoring. */
export interface ActivityPlanResult {
  readonly activity: ActivityType;
  readonly persona: PersonaId;
  readonly bestWindow: ActivityScorePoint | undefined;
  readonly worstWindow: ActivityScorePoint | undefined;
  readonly timeline: readonly ActivityScorePoint[];
}

/** User-configured browser localStorage alert threshold rule. */
export interface ThresholdAlertRule {
  readonly id: string;
  readonly cityKey: string;
  readonly cityName: string;
  readonly metric: "usAqi" | "pm25";
  readonly threshold: number;
  readonly enabled: boolean;
}

/** Active alert warning emitted when a loaded report exceeds a rule's threshold. */
export interface TriggeredAlert {
  readonly ruleId: string;
  readonly cityKey: string;
  readonly cityName: string;
  readonly metric: "usAqi" | "pm25";
  readonly threshold: number;
  readonly actualValue: number;
}

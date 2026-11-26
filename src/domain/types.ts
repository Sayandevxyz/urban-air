/**
 * Pure domain types for air quality measurements, smog assessment,
 * personalized guidance, routines, direct impact calculations, and alerts.
 */

export type PollutantKey = "pm25" | "pm10" | "no2" | "o3" | "so2" | "co";

export type AqiCategory =
  "good" | "moderate" | "sensitive" | "unhealthy" | "very_unhealthy" | "hazardous";

export type EuropeanAqiBand =
  "good" | "fair" | "moderate" | "poor" | "very_poor" | "extremely_poor";

export type PersonaId =
  "general" | "children" | "elderly" | "asthma" | "pregnant" | "athlete" | "worker";

export type CommuteMode = "car" | "transit" | "two_wheeler" | "walk_cycle";
export type HomeEnergyMode = "gas_biomass" | "electric_induction";
export type FiltrationMode = "none" | "hepa" | "diy_box_fan";
export type ActivityType = "run" | "cycle" | "walk" | "ventilate";

export interface PollutantReadings {
  readonly pm25: number;
  readonly pm10: number;
  readonly no2: number;
  readonly o3: number;
  readonly so2: number;
  readonly co: number;
}

export interface PollutantAssessment {
  readonly key: PollutantKey;
  readonly valueUgM3: number;
  readonly whoGuidelineUgM3: number;
  readonly whoRatio: number;
  readonly exceedsWho: boolean;
  readonly subIndexUsAqi: number;
  readonly isDominant: boolean;
}

export interface UsAqiClassification {
  readonly category: AqiCategory;
  readonly severityRank: 1 | 2 | 3 | 4 | 5 | 6;
  readonly iconId:
    "leaf" | "sun-cloud" | "shield-alert" | "mask-warning" | "smog-danger" | "biohazard";
  readonly patternId: "solid" | "dots" | "diagonal" | "crosshatch" | "grid" | "dense-bars";
  readonly tokenName: string;
}

export type SmogSeverity = "none" | "elevated" | "severe_smog" | "smog_emergency";

export interface SmogAssessment {
  readonly severity: SmogSeverity;
  readonly isWinterSmogAlert: boolean;
  readonly inversionTrapLikely: boolean;
  readonly primaryDrivers: readonly PollutantKey[];
}

export interface HourlyForecastPoint {
  readonly timeIso: string;
  readonly usAqi: number;
  readonly europeanAqi: number;
  readonly pm25: number;
  readonly pm10: number;
  readonly no2: number;
  readonly o3: number;
}

export interface DailyTrendPoint {
  readonly dateIso: string;
  readonly avgUsAqi: number;
  readonly maxUsAqi: number;
  readonly minUsAqi: number;
  readonly avgPm25: number;
}

export interface CityLocation {
  readonly key: string;
  readonly name: string;
  readonly region: string;
  readonly country: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
}

export interface AirQualityReport {
  readonly location: CityLocation;
  readonly updatedAtIso: string;
  readonly source: "open-meteo" | "demo" | "cached";
  readonly current: {
    readonly usAqi: number;
    readonly europeanAqi: number;
    readonly readings: PollutantReadings;
  };
  readonly hourly: readonly HourlyForecastPoint[];
  readonly daily: readonly DailyTrendPoint[];
}

export interface ResidentProfile {
  readonly persona: PersonaId;
  readonly commuteMode: CommuteMode;
  readonly homeEnergyMode: HomeEnergyMode;
  readonly filtrationMode: FiltrationMode;
}

export type MaskAdviceKey =
  "none_needed" | "optional_sensitive" | "n95_recommended" | "n95_required";
export type WindowsAdviceKey = "open_cross_ventilation" | "brief_clean_window" | "keep_sealed";
export type OutdoorAdviceKey =
  "normal_outdoor" | "pace_outdoors" | "shift_indoors" | "avoid_outdoors";

export interface PersonaGuidance {
  readonly persona: PersonaId;
  readonly maskAdvice: MaskAdviceKey;
  readonly windowsAdvice: WindowsAdviceKey;
  readonly outdoorAdvice: OutdoorAdviceKey;
  readonly recommendedWindowIso: string | undefined;
  readonly highSensitivityWarning: boolean;
  readonly checklistKeys: readonly string[];
}

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

export interface DirectImpactResult {
  readonly personalPm25AvoidedUg: number;
  readonly baselineOutdoorPm25InhaledUg: number;
  readonly personalReductionPercent: number;
  readonly communityCo2SavedGrams: number;
  readonly communityNoxSavedGrams: number;
  readonly breakdown: readonly ImpactBreakdownItem[];
}

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

export interface ActivityPlanResult {
  readonly activity: ActivityType;
  readonly persona: PersonaId;
  readonly bestWindow: ActivityScorePoint | undefined;
  readonly worstWindow: ActivityScorePoint | undefined;
  readonly timeline: readonly ActivityScorePoint[];
}

export interface ThresholdAlertRule {
  readonly id: string;
  readonly cityKey: string;
  readonly cityName: string;
  readonly metric: "usAqi" | "pm25";
  readonly threshold: number;
  readonly enabled: boolean;
}

export interface TriggeredAlert {
  readonly ruleId: string;
  readonly cityKey: string;
  readonly cityName: string;
  readonly metric: "usAqi" | "pm25";
  readonly threshold: number;
  readonly actualValue: number;
}

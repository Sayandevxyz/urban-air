import type {
  CommuteMode,
  DirectImpactResult,
  ImpactBreakdownItem,
  ImpactChoiceInput,
  PollutantReadings,
  ResidentProfile,
} from "@/domain/types";

const OUTDOOR_ACTIVE_VENTILATION_M3_PER_HOUR = 1.8;
const INDOOR_REST_VENTILATION_M3_PER_HOUR = 0.5;
const N95_FILTRATION_EFFICIENCY = 0.92;
const HEPA_FILTRATION_EFFICIENCY = 0.65;
const DIY_FAN_FILTRATION_EFFICIENCY = 0.5;
const INDOOR_INFILTRATION_FACTOR = 0.65;
const INDOOR_FILTRATION_EXPOSURE_HOURS = 8;
const CLEAN_COOKING_PM25_REDUCTION_UG_M3 = 35;
const COOKING_EXPOSURE_HOURS = 1.5;

const COMMUTE_CO2_G_PER_KM: Readonly<Record<CommuteMode, number>> = {
  car: 171,
  two_wheeler: 72,
  transit: 41,
  walk_cycle: 0,
};

const COMMUTE_NOX_G_PER_KM: Readonly<Record<CommuteMode, number>> = {
  car: 0.18,
  two_wheeler: 0.11,
  transit: 0.04,
  walk_cycle: 0,
};

function computeCommuteSavings(
  choices: ImpactChoiceInput,
  commuteMode: CommuteMode,
): ImpactBreakdownItem {
  if (!choices.swapCarToCleanTransit || choices.commuteDistanceKm <= 0) {
    return { id: "commute_emissions", pm25AvoidedUg: 0, co2SavedGrams: 0, noxSavedGrams: 0 };
  }
  const co2Diff = Math.max(0, COMMUTE_CO2_G_PER_KM[commuteMode] - COMMUTE_CO2_G_PER_KM.transit);
  const noxDiff = Math.max(0, COMMUTE_NOX_G_PER_KM[commuteMode] - COMMUTE_NOX_G_PER_KM.transit);
  return {
    id: "commute_emissions",
    pm25AvoidedUg: 0,
    co2SavedGrams: Math.round(co2Diff * choices.commuteDistanceKm),
    noxSavedGrams: Math.round(noxDiff * choices.commuteDistanceKm * 100) / 100,
  };
}

function computeTimingAndMaskSavings(
  choices: ImpactChoiceInput,
  currentPm25: number,
): { timing: ImpactBreakdownItem; mask: ImpactBreakdownItem } {
  const outdoorVolumeM3 = choices.outdoorHours * OUTDOOR_ACTIVE_VENTILATION_M3_PER_HOUR;
  const effectivePm25AfterTiming =
    choices.shiftActivityToBestWindow && choices.bestWindowPm25UgM3 < currentPm25
      ? choices.bestWindowPm25UgM3
      : currentPm25;

  const timingAvoided = Math.round((currentPm25 - effectivePm25AfterTiming) * outdoorVolumeM3);
  const maskAvoided = choices.wearFittedN95Outdoors
    ? Math.round(effectivePm25AfterTiming * outdoorVolumeM3 * N95_FILTRATION_EFFICIENCY)
    : 0;

  return {
    timing: {
      id: "timing_exposure",
      pm25AvoidedUg: timingAvoided,
      co2SavedGrams: 0,
      noxSavedGrams: 0,
    },
    mask: { id: "mask_protection", pm25AvoidedUg: maskAvoided, co2SavedGrams: 0, noxSavedGrams: 0 },
  };
}

function computeIndoorAndCookingSavings(
  choices: ImpactChoiceInput,
  currentPm25: number,
  profile: ResidentProfile,
): { filtration: ImpactBreakdownItem; cooking: ImpactBreakdownItem } {
  const filterEfficiency =
    profile.filtrationMode === "diy_box_fan"
      ? DIY_FAN_FILTRATION_EFFICIENCY
      : HEPA_FILTRATION_EFFICIENCY;
  const indoorBaselinePm25 = currentPm25 * INDOOR_INFILTRATION_FACTOR;
  const filtrationAvoided = choices.runIndoorAirFiltration
    ? Math.round(
        indoorBaselinePm25 *
          filterEfficiency *
          INDOOR_REST_VENTILATION_M3_PER_HOUR *
          INDOOR_FILTRATION_EXPOSURE_HOURS,
      )
    : 0;

  const cookingAvoided = choices.useCleanCookingAndExhaust
    ? Math.round(
        CLEAN_COOKING_PM25_REDUCTION_UG_M3 *
          INDOOR_REST_VENTILATION_M3_PER_HOUR *
          COOKING_EXPOSURE_HOURS,
      )
    : 0;

  return {
    filtration: {
      id: "indoor_filtration",
      pm25AvoidedUg: filtrationAvoided,
      co2SavedGrams: 0,
      noxSavedGrams: 0,
    },
    cooking: {
      id: "clean_cooking",
      pm25AvoidedUg: cookingAvoided,
      co2SavedGrams: 0,
      noxSavedGrams: 0,
    },
  };
}

/**
 * Quantifies the direct personal exposure reduction (ug PM2.5 avoided) and community
 * emissions avoided (g CO2e, g NOx) from a resident's chosen routine and indoor air swaps.
 */
export function calculateDirectImpact(
  choices: ImpactChoiceInput,
  readings: PollutantReadings,
  profile: ResidentProfile,
): DirectImpactResult {
  const commute = computeCommuteSavings(choices, profile.commuteMode);
  const { timing, mask } = computeTimingAndMaskSavings(choices, readings.pm25);
  const { filtration, cooking } = computeIndoorAndCookingSavings(choices, readings.pm25, profile);
  const breakdown: readonly ImpactBreakdownItem[] = [commute, timing, mask, filtration, cooking];

  const personalPm25AvoidedUg =
    timing.pm25AvoidedUg + mask.pm25AvoidedUg + filtration.pm25AvoidedUg + cooking.pm25AvoidedUg;

  const baselineOutdoorPm25InhaledUg = Math.round(
    readings.pm25 * choices.outdoorHours * OUTDOOR_ACTIVE_VENTILATION_M3_PER_HOUR +
      readings.pm25 *
        INDOOR_INFILTRATION_FACTOR *
        INDOOR_REST_VENTILATION_M3_PER_HOUR *
        INDOOR_FILTRATION_EXPOSURE_HOURS,
  );

  const personalReductionPercent =
    baselineOutdoorPm25InhaledUg > 0
      ? Math.min(99, Math.round((personalPm25AvoidedUg / baselineOutdoorPm25InhaledUg) * 100))
      : 0;

  return {
    personalPm25AvoidedUg,
    baselineOutdoorPm25InhaledUg,
    personalReductionPercent,
    communityCo2SavedGrams: commute.co2SavedGrams,
    communityNoxSavedGrams: commute.noxSavedGrams,
    breakdown,
  };
}

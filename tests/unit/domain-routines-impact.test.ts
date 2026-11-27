// ============================================================================
// tests/unit/domain-routines-impact.test.ts
// Tests low-emission routine logic and personal/community impact calculations.
// ============================================================================

import { expect, test } from "vitest";
import { assessWinterSmog } from "@/domain/aqi";
import { calculateDirectImpact } from "@/domain/impact";
import { buildRoutinesAndAlternatives } from "@/domain/routines";
import type { PollutantReadings } from "@/types/air-quality";
import type { ImpactChoiceInput, ResidentProfile } from "@/types/guidance";

const SMOG: PollutantReadings = { pm25: 120, pm10: 205, no2: 88, o3: 32, so2: 18, co: 1900 };
const CLEAN: PollutantReadings = { pm25: 8, pm10: 20, no2: 14, o3: 40, so2: 5, co: 200 };
const CAR_GAS: ResidentProfile = {
  persona: "general",
  commuteMode: "car",
  homeEnergyMode: "gas_biomass",
  filtrationMode: "none",
};
const ALL_ON: ImpactChoiceInput = {
  commuteDistanceKm: 10,
  swapCarToCleanTransit: true,
  shiftActivityToBestWindow: true,
  wearFittedN95Outdoors: true,
  useCleanCookingAndExhaust: true,
  runIndoorAirFiltration: true,
  outdoorHours: 1,
  bestWindowPm25UgM3: 40,
};

test("tailors low-emission routines to smog episodes vs clean active lifestyles", () => {
  const smogRoutines = buildRoutinesAndAlternatives({
    usAqi: 195,
    smog: assessWinterSmog(195, SMOG),
    readings: SMOG,
    profile: CAR_GAS,
    bestWindowHourIso: "2026-11-26T15:00:00Z",
  });
  expect(smogRoutines.map((r) => r.id)).toEqual([
    "shift_to_transit_or_active",
    "avoid_morning_smog_commute",
    "remote_work_or_carpool",
    "clean_cooking_switch",
    "outdoor_exercise_reschedule",
  ]);

  const cleanActive = buildRoutinesAndAlternatives({
    usAqi: 35,
    smog: assessWinterSmog(35, CLEAN),
    readings: CLEAN,
    profile: {
      persona: "athlete",
      commuteMode: "walk_cycle",
      homeEnergyMode: "electric_induction",
      filtrationMode: "hepa",
    },
    bestWindowHourIso: undefined,
  });
  expect(cleanActive.map((r) => r.id)).toEqual([
    "bundle_errands_clean_window",
    "outdoor_exercise_reschedule",
  ]);
});

test("scales routine priority cleanly across moderate vs AQI 101 thresholds", () => {
  const moderate = buildRoutinesAndAlternatives({
    usAqi: 100,
    smog: assessWinterSmog(100, { ...CLEAN, no2: 59 }),
    readings: { ...CLEAN, no2: 59 },
    profile: { ...CAR_GAS, commuteMode: "two_wheeler" },
    bestWindowHourIso: "2026-11-26T15:00:00Z",
  });
  expect(moderate.find((r) => r.id === "shift_to_transit_or_active")?.priority).toBe("medium");
  expect(moderate.find((r) => r.id === "clean_cooking_switch")?.priority).toBe("medium");

  const threshold = buildRoutinesAndAlternatives({
    usAqi: 101,
    smog: assessWinterSmog(101, { ...CLEAN, no2: 60 }),
    readings: { ...CLEAN, no2: 60 },
    profile: CAR_GAS,
    bestWindowHourIso: "2026-11-26T15:00:00Z",
  });
  expect(
    ["outdoor_exercise_reschedule", "shift_to_transit_or_active", "clean_cooking_switch"].every(
      (id) => threshold.find((r) => r.id === id)?.priority === "high",
    ),
  ).toBe(true);
});

test("quantifies exact PM2.5 avoided and CO2e/NOx breakdown for full routine swaps", () => {
  const fullSwap = calculateDirectImpact(
    ALL_ON,
    { pm25: 100, pm10: 200, no2: 80, o3: 30, so2: 20, co: 2000 },
    { ...CAR_GAS, filtrationMode: "hepa" },
  );
  expect(fullSwap).toEqual({
    personalPm25AvoidedUg: 369,
    baselineOutdoorPm25InhaledUg: 440,
    personalReductionPercent: 84,
    communityCo2SavedGrams: 1300,
    communityNoxSavedGrams: 1.4,
    breakdown: [
      { id: "commute_emissions", pm25AvoidedUg: 0, co2SavedGrams: 1300, noxSavedGrams: 1.4 },
      { id: "timing_exposure", pm25AvoidedUg: 108, co2SavedGrams: 0, noxSavedGrams: 0 },
      { id: "mask_protection", pm25AvoidedUg: 66, co2SavedGrams: 0, noxSavedGrams: 0 },
      { id: "indoor_filtration", pm25AvoidedUg: 169, co2SavedGrams: 0, noxSavedGrams: 0 },
      { id: "clean_cooking", pm25AvoidedUg: 26, co2SavedGrams: 0, noxSavedGrams: 0 },
    ],
  });
});

test("caps percentage reduction at 99 when outdoor exposure is zero", () => {
  const capped = calculateDirectImpact(
    {
      ...ALL_ON,
      commuteDistanceKm: 0,
      shiftActivityToBestWindow: false,
      wearFittedN95Outdoors: false,
      outdoorHours: 0,
      bestWindowPm25UgM3: 5,
    },
    { pm25: 10, pm10: 20, no2: 10, o3: 20, so2: 5, co: 200 },
    { ...CAR_GAS, commuteMode: "walk_cycle", filtrationMode: "hepa" },
  );
  expect([capped.personalReductionPercent, capped.communityCo2SavedGrams]).toEqual([99, 0]);
});

test("returns zero savings when swaps disabled and handles two-wheeler + DIY fan", () => {
  const zero = calculateDirectImpact(
    {
      ...ALL_ON,
      commuteDistanceKm: 0,
      swapCarToCleanTransit: false,
      shiftActivityToBestWindow: false,
      wearFittedN95Outdoors: false,
      useCleanCookingAndExhaust: false,
      runIndoorAirFiltration: false,
      outdoorHours: 0,
    },
    CLEAN,
    CAR_GAS,
  );
  expect(zero).toMatchObject({
    personalPm25AvoidedUg: 0,
    personalReductionPercent: 0,
    communityCo2SavedGrams: 0,
  });

  const twoWheeler = calculateDirectImpact(
    {
      ...ALL_ON,
      wearFittedN95Outdoors: false,
      useCleanCookingAndExhaust: false,
      bestWindowPm25UgM3: 140,
    },
    { ...SMOG, pm25: 0 },
    {
      persona: "worker",
      commuteMode: "two_wheeler",
      homeEnergyMode: "electric_induction",
      filtrationMode: "diy_box_fan",
    },
  );
  expect([twoWheeler.communityCo2SavedGrams, twoWheeler.personalReductionPercent]).toEqual([
    310, 0,
  ]);
});

import { describe, expect, it } from "vitest";
import { assessWinterSmog } from "@/domain/aqi";
import { calculateDirectImpact } from "@/domain/impact";
import { buildRoutinesAndAlternatives } from "@/domain/routines";
import type { PollutantReadings, ResidentProfile } from "@/domain/types";

const SMOG_READINGS: PollutantReadings = {
  pm25: 120,
  pm10: 205,
  no2: 88,
  o3: 32,
  so2: 18,
  co: 1900,
};

const CLEAN_READINGS: PollutantReadings = {
  pm25: 8,
  pm10: 20,
  no2: 14,
  o3: 40,
  so2: 5,
  co: 200,
};

const CAR_GAS_PROFILE: ResidentProfile = {
  persona: "general",
  commuteMode: "car",
  homeEnergyMode: "gas_biomass",
  filtrationMode: "none",
};

describe("domain/routines and domain/impact", () => {
  it("suggests low-emission routines tailored to smog, car commute, and gas/biomass cooking", () => {
    const smog = assessWinterSmog(195, SMOG_READINGS);
    const routines = buildRoutinesAndAlternatives({
      usAqi: 195,
      smog,
      readings: SMOG_READINGS,
      profile: CAR_GAS_PROFILE,
      bestWindowHourIso: "2026-11-26T15:00:00Z",
    });
    const ids = routines.map((r) => r.id);

    expect(ids).toContain("shift_to_transit_or_active");
    expect(ids).toContain("avoid_morning_smog_commute");
    expect(ids).toContain("clean_cooking_switch");
    expect(ids).toContain("remote_work_or_carpool");
    expect(ids).toContain("outdoor_exercise_reschedule");
  });

  it("adapts routines for residents already using clean transit and electric induction", () => {
    const cleanSmog = assessWinterSmog(35, CLEAN_READINGS);
    const routines = buildRoutinesAndAlternatives({
      usAqi: 35,
      smog: cleanSmog,
      readings: CLEAN_READINGS,
      profile: {
        persona: "athlete",
        commuteMode: "walk_cycle",
        homeEnergyMode: "electric_induction",
        filtrationMode: "hepa",
      },
      bestWindowHourIso: undefined,
    });
    expect(routines.map((r) => r.id)).toContain("bundle_errands_clean_window");
    expect(routines.map((r) => r.id)).not.toContain("clean_cooking_switch");
  });

  it("quantifies personal PM2.5 inhalation avoided and community CO2/NOx saved accurately", () => {
    const result = calculateDirectImpact(
      {
        commuteDistanceKm: 12,
        swapCarToCleanTransit: true,
        shiftActivityToBestWindow: true,
        wearFittedN95Outdoors: true,
        useCleanCookingAndExhaust: true,
        runIndoorAirFiltration: true,
        outdoorHours: 1.5,
        bestWindowPm25UgM3: 40,
      },
      SMOG_READINGS,
      CAR_GAS_PROFILE,
    );

    expect(result.baselineOutdoorPm25InhaledUg).toBeGreaterThan(0);
    expect(result.personalPm25AvoidedUg).toBeGreaterThan(100);
    expect(result.personalReductionPercent).toBeGreaterThan(30);
    expect(result.personalReductionPercent).toBeLessThanOrEqual(99);
    expect(result.communityCo2SavedGrams).toBe(1560);
    expect(result.communityNoxSavedGrams).toBe(1.68);
    expect(result.breakdown).toHaveLength(5);

    const exact = calculateDirectImpact(
      {
        commuteDistanceKm: 10,
        swapCarToCleanTransit: true,
        shiftActivityToBestWindow: true,
        wearFittedN95Outdoors: true,
        useCleanCookingAndExhaust: true,
        runIndoorAirFiltration: true,
        outdoorHours: 1,
        bestWindowPm25UgM3: 40,
      },
      { pm25: 100, pm10: 200, no2: 80, o3: 30, so2: 20, co: 2000 },
      {
        persona: "general",
        commuteMode: "car",
        homeEnergyMode: "gas_biomass",
        filtrationMode: "hepa",
      },
    );
    expect(exact).toEqual({
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

    const cappedPct = calculateDirectImpact(
      {
        commuteDistanceKm: 0,
        swapCarToCleanTransit: true,
        shiftActivityToBestWindow: false,
        wearFittedN95Outdoors: false,
        useCleanCookingAndExhaust: true,
        runIndoorAirFiltration: true,
        outdoorHours: 0,
        bestWindowPm25UgM3: 5,
      },
      { pm25: 10, pm10: 20, no2: 10, o3: 20, so2: 5, co: 200 },
      {
        persona: "general",
        commuteMode: "walk_cycle",
        homeEnergyMode: "gas_biomass",
        filtrationMode: "hepa",
      },
    );
    expect(cappedPct.personalReductionPercent).toBe(99);
    expect(cappedPct.communityCo2SavedGrams).toBe(0);
  });

  it("returns zero savings when no swaps are selected and supports two-wheeler & DIY filter factors", () => {
    const zero = calculateDirectImpact(
      {
        commuteDistanceKm: 0,
        swapCarToCleanTransit: false,
        shiftActivityToBestWindow: false,
        wearFittedN95Outdoors: false,
        useCleanCookingAndExhaust: false,
        runIndoorAirFiltration: false,
        outdoorHours: 0,
        bestWindowPm25UgM3: 120,
      },
      CLEAN_READINGS,
      CAR_GAS_PROFILE,
    );
    expect(zero.personalPm25AvoidedUg).toBe(0);
    expect(zero.personalReductionPercent).toBe(0);
    expect(zero.communityCo2SavedGrams).toBe(0);

    const twoWheelerDiy = calculateDirectImpact(
      {
        commuteDistanceKm: 10,
        swapCarToCleanTransit: true,
        shiftActivityToBestWindow: true,
        wearFittedN95Outdoors: false,
        useCleanCookingAndExhaust: false,
        runIndoorAirFiltration: true,
        outdoorHours: 1,
        bestWindowPm25UgM3: 140,
      },
      { ...SMOG_READINGS, pm25: 0 },
      {
        persona: "worker",
        commuteMode: "two_wheeler",
        homeEnergyMode: "electric_induction",
        filtrationMode: "diy_box_fan",
      },
    );
    expect(twoWheelerDiy.communityCo2SavedGrams).toBe(310);
    expect(twoWheelerDiy.personalReductionPercent).toBe(0);

    const routinesTrafficModerate = buildRoutinesAndAlternatives({
      usAqi: 115,
      smog: assessWinterSmog(115, { ...CLEAN_READINGS, pm25: 40, no2: 70 }),
      readings: { ...CLEAN_READINGS, pm25: 40, no2: 70 },
      profile: CAR_GAS_PROFILE,
      bestWindowHourIso: "2026-11-26T15:00:00Z",
    });
    expect(
      routinesTrafficModerate.find((r) => r.id === "shift_to_transit_or_active")?.priority,
    ).toBe("high");
    expect(routinesTrafficModerate.find((r) => r.id === "clean_cooking_switch")?.priority).toBe(
      "high",
    );

    const routinesCleanGas = buildRoutinesAndAlternatives({
      usAqi: 100,
      smog: assessWinterSmog(100, { ...CLEAN_READINGS, no2: 59 }),
      readings: { ...CLEAN_READINGS, no2: 59 },
      profile: { ...CAR_GAS_PROFILE, commuteMode: "two_wheeler" },
      bestWindowHourIso: "2026-11-26T15:00:00Z",
    });
    expect(routinesCleanGas.find((r) => r.id === "shift_to_transit_or_active")).toMatchObject({
      category: "commute",
      priority: "medium",
      suggestedHourIso: "2026-11-26T15:00:00Z",
    });
    expect(routinesCleanGas.find((r) => r.id === "clean_cooking_switch")).toMatchObject({
      category: "home",
      priority: "medium",
      suggestedHourIso: undefined,
    });
    expect(routinesCleanGas.find((r) => r.id === "outdoor_exercise_reschedule")).toMatchObject({
      category: "exercise",
      priority: "medium",
      suggestedHourIso: "2026-11-26T15:00:00Z",
    });

    const atThreshold101 = buildRoutinesAndAlternatives({
      usAqi: 101,
      smog: assessWinterSmog(101, { ...CLEAN_READINGS, no2: 60 }),
      readings: { ...CLEAN_READINGS, no2: 60 },
      profile: CAR_GAS_PROFILE,
      bestWindowHourIso: "2026-11-26T15:00:00Z",
    });
    expect(atThreshold101.find((r) => r.id === "outdoor_exercise_reschedule")?.priority).toBe(
      "high",
    );
    expect(atThreshold101.find((r) => r.id === "shift_to_transit_or_active")?.priority).toBe(
      "high",
    );
    expect(atThreshold101.find((r) => r.id === "clean_cooking_switch")?.priority).toBe("high");
  });
});

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
    expect(result.communityNoxSavedGrams).toBeGreaterThan(1.5);
    expect(result.breakdown).toHaveLength(5);
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
      usAqi: 45,
      smog: assessWinterSmog(45, CLEAN_READINGS),
      readings: CLEAN_READINGS,
      profile: CAR_GAS_PROFILE,
      bestWindowHourIso: "2026-11-26T15:00:00Z",
    });
    expect(routinesCleanGas.find((r) => r.id === "shift_to_transit_or_active")?.priority).toBe(
      "medium",
    );
    expect(routinesCleanGas.find((r) => r.id === "clean_cooking_switch")?.priority).toBe("medium");
  });
});

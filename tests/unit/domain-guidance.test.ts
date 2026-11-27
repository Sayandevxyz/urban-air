import { describe, expect, it } from "vitest";
import { assessWinterSmog } from "@/domain/aqi";
import { buildIndoorAirHacks, buildPersonaGuidance } from "@/domain/guidance";
import type { HourlyForecastPoint, PollutantReadings } from "@/types/air-quality";
import type { PersonaId, ResidentProfile } from "@/types/guidance";

const BASE_PROFILE: ResidentProfile = {
  persona: "general",
  commuteMode: "car",
  homeEnergyMode: "gas_biomass",
  filtrationMode: "none",
};

const HOURLY_SAMPLE: readonly HourlyForecastPoint[] = [
  {
    timeIso: "2026-11-26T08:00:00Z",
    usAqi: 190,
    europeanAqi: 95,
    pm25: 110,
    pm10: 180,
    no2: 90,
    o3: 30,
  },
  {
    timeIso: "2026-11-26T15:00:00Z",
    usAqi: 72,
    europeanAqi: 42,
    pm25: 22,
    pm10: 48,
    no2: 30,
    o3: 55,
  },
  {
    timeIso: "2026-11-26T21:00:00Z",
    usAqi: 165,
    europeanAqi: 82,
    pm25: 75,
    pm10: 140,
    no2: 70,
    o3: 25,
  },
];

const SEVERE_READINGS: PollutantReadings = {
  pm25: 120,
  pm10: 210,
  no2: 92,
  o3: 35,
  so2: 18,
  co: 1900,
};

const CLEAN_READINGS: PollutantReadings = {
  pm25: 7,
  pm10: 19,
  no2: 14,
  o3: 40,
  so2: 4,
  co: 200,
};

describe("domain/guidance", () => {
  it("provides tailored guidance across all 7 personas during clean and severe smog conditions", () => {
    const personas: readonly PersonaId[] = [
      "general",
      "children",
      "elderly",
      "asthma",
      "pregnant",
      "athlete",
      "worker",
    ];
    const cleanSmog = assessWinterSmog(35, CLEAN_READINGS);
    const severeSmog = assessWinterSmog(205, SEVERE_READINGS);

    for (const persona of personas) {
      const cleanGuidance = buildPersonaGuidance({
        usAqi: 35,
        smog: cleanSmog,
        readings: CLEAN_READINGS,
        profile: { ...BASE_PROFILE, persona },
        hourly: HOURLY_SAMPLE,
      });
      expect(cleanGuidance.maskAdvice).toBe("none_needed");
      expect(cleanGuidance.windowsAdvice).toBe("open_cross_ventilation");

      const severeGuidance = buildPersonaGuidance({
        usAqi: 205,
        smog: severeSmog,
        readings: SEVERE_READINGS,
        profile: { ...BASE_PROFILE, persona },
        hourly: HOURLY_SAMPLE,
      });
      expect(severeGuidance.maskAdvice).toBe("n95_required");
      expect(severeGuidance.windowsAdvice).toBe("keep_sealed");
      expect(severeGuidance.highSensitivityWarning).toBe(true);
    }
  });

  it("differentiates moderate vs sensitive AQI tiers and recommends cleaner window hours", () => {
    const modReadings = { ...CLEAN_READINGS, pm25: 28 };
    const modSmog = assessWinterSmog(85, modReadings);

    const asthmaModerate = buildPersonaGuidance({
      usAqi: 85,
      smog: modSmog,
      readings: modReadings,
      profile: { ...BASE_PROFILE, persona: "asthma" },
      hourly: HOURLY_SAMPLE,
    });
    expect(asthmaModerate.maskAdvice).toBe("optional_sensitive");
    expect(asthmaModerate.windowsAdvice).toBe("brief_clean_window");
    expect(asthmaModerate.recommendedWindowIso).toBe("2026-11-26T15:00:00Z");

    const generalModerate = buildPersonaGuidance({
      usAqi: 85,
      smog: modSmog,
      readings: modReadings,
      profile: BASE_PROFILE,
      hourly: HOURLY_SAMPLE,
    });
    expect(generalModerate.maskAdvice).toBe("none_needed");
    expect(generalModerate.outdoorAdvice).toBe("normal_outdoor");

    const sensitiveSmog = assessWinterSmog(135, { ...CLEAN_READINGS, pm25: 48 });
    const workerSensitive = buildPersonaGuidance({
      usAqi: 135,
      smog: sensitiveSmog,
      readings: { ...CLEAN_READINGS, pm25: 48 },
      profile: { ...BASE_PROFILE, persona: "worker" },
      hourly: HOURLY_SAMPLE,
    });
    expect(workerSensitive.maskAdvice).toBe("n95_recommended");
    expect(workerSensitive.outdoorAdvice).toBe("pace_outdoors");

    const generalUnhealthy = buildPersonaGuidance({
      usAqi: 175,
      smog: assessWinterSmog(175, { ...CLEAN_READINGS, pm25: 75 }),
      readings: { ...CLEAN_READINGS, pm25: 75, o3: 115 },
      profile: BASE_PROFILE,
      hourly: HOURLY_SAMPLE,
    });
    expect(generalUnhealthy.outdoorAdvice).toBe("shift_indoors");
    expect(generalUnhealthy.checklistKeys).toContain("ozone_avoid_afternoon_peak");

    const asthmaSensitive = buildPersonaGuidance({
      usAqi: 135,
      smog: sensitiveSmog,
      readings: { ...CLEAN_READINGS, pm25: 48 },
      profile: { ...BASE_PROFILE, persona: "asthma" },
      hourly: HOURLY_SAMPLE,
    });
    expect(asthmaSensitive.outdoorAdvice).toBe("shift_indoors");

    const asthmaUnhealthy = buildPersonaGuidance({
      usAqi: 175,
      smog: assessWinterSmog(175, { ...CLEAN_READINGS, pm25: 75 }),
      readings: { ...CLEAN_READINGS, pm25: 75 },
      profile: { ...BASE_PROFILE, persona: "asthma" },
      hourly: HOURLY_SAMPLE,
    });
    expect(asthmaUnhealthy.outdoorAdvice).toBe("avoid_outdoors");

    const boundary50Sensitive = buildPersonaGuidance({
      usAqi: 50,
      smog: assessWinterSmog(50, CLEAN_READINGS),
      readings: { ...CLEAN_READINGS, o3: 99 },
      profile: { ...BASE_PROFILE, persona: "children" },
      hourly: HOURLY_SAMPLE,
    });
    expect(boundary50Sensitive.maskAdvice).toBe("none_needed");
    expect(boundary50Sensitive.windowsAdvice).toBe("open_cross_ventilation");
    expect(boundary50Sensitive.checklistKeys).not.toContain("ozone_avoid_afternoon_peak");

    const boundary51 = buildPersonaGuidance({
      usAqi: 51,
      smog: assessWinterSmog(51, CLEAN_READINGS),
      readings: { ...CLEAN_READINGS, o3: 100 },
      profile: { ...BASE_PROFILE, persona: "children" },
      hourly: HOURLY_SAMPLE,
    });
    expect(boundary51.maskAdvice).toBe("optional_sensitive");
    expect(boundary51.windowsAdvice).toBe("brief_clean_window");
    expect(boundary51.highSensitivityWarning).toBe(false);
    expect(boundary51.checklistKeys).toContain("ozone_avoid_afternoon_peak");

    const boundary101General = buildPersonaGuidance({
      usAqi: 101,
      smog: assessWinterSmog(101, CLEAN_READINGS),
      readings: CLEAN_READINGS,
      profile: BASE_PROFILE,
      hourly: HOURLY_SAMPLE,
    });
    expect(boundary101General.maskAdvice).toBe("n95_recommended");
    expect(boundary101General.highSensitivityWarning).toBe(false);

    const boundary150General = buildPersonaGuidance({
      usAqi: 150,
      smog: assessWinterSmog(150, CLEAN_READINGS),
      readings: CLEAN_READINGS,
      profile: BASE_PROFILE,
      hourly: HOURLY_SAMPLE,
    });
    expect(boundary150General.maskAdvice).toBe("n95_recommended");
    expect(boundary150General.windowsAdvice).toBe("brief_clean_window");
    expect(boundary150General.highSensitivityWarning).toBe(false);

    const boundary151General = buildPersonaGuidance({
      usAqi: 151,
      smog: assessWinterSmog(151, CLEAN_READINGS),
      readings: CLEAN_READINGS,
      profile: BASE_PROFILE,
      hourly: HOURLY_SAMPLE,
    });
    expect(boundary151General.maskAdvice).toBe("n95_required");
    expect(boundary151General.windowsAdvice).toBe("keep_sealed");
    expect(boundary151General.outdoorAdvice).toBe("shift_indoors");
    expect(boundary151General.highSensitivityWarning).toBe(true);

    const boundary201General = buildPersonaGuidance({
      usAqi: 201,
      smog: assessWinterSmog(201, SEVERE_READINGS),
      readings: SEVERE_READINGS,
      profile: BASE_PROFILE,
      hourly: HOURLY_SAMPLE,
    });
    expect(boundary201General.outdoorAdvice).toBe("avoid_outdoors");
  });

  it("handles empty hourly forecast gracefully for clean window selection", () => {
    const smog = assessWinterSmog(115, { ...CLEAN_READINGS, pm25: 41 });
    const guidance = buildPersonaGuidance({
      usAqi: 115,
      smog,
      readings: { ...CLEAN_READINGS, pm25: 41 },
      profile: BASE_PROFILE,
      hourly: [],
    });
    expect(guidance.recommendedWindowIso).toBeUndefined();
  });

  it("selects contextual indoor air quality hacks based on smog, filtration, and cooking energy", () => {
    const severeSmog = assessWinterSmog(210, SEVERE_READINGS);
    const noFilterHacks = buildIndoorAirHacks(210, severeSmog, SEVERE_READINGS, BASE_PROFILE);
    expect(noFilterHacks.map((h) => h.id)).toContain("seal_smog_drafts");
    expect(noFilterHacks.map((h) => h.id)).toContain("build_diy_box_filter");
    expect(noFilterHacks.map((h) => h.id)).toContain("exhaust_or_induction_cook");

    const hepaModerate = buildIndoorAirHacks(
      100,
      assessWinterSmog(100, { ...CLEAN_READINGS, no2: 39 }),
      { ...CLEAN_READINGS, no2: 39 },
      {
        ...BASE_PROFILE,
        filtrationMode: "hepa",
        homeEnergyMode: "electric_induction",
      },
    );
    expect(hepaModerate).toEqual([
      { id: "timed_window_purge", priority: "standard" },
      { id: "run_hepa_filtration", priority: "high" },
      { id: "wet_mop_dust", priority: "standard" },
      { id: "stop_indoor_combustion", priority: "standard" },
    ]);

    const boundary101 = buildIndoorAirHacks(
      101,
      assessWinterSmog(101, { ...CLEAN_READINGS, no2: 40 }),
      { ...CLEAN_READINGS, no2: 40 },
      {
        ...BASE_PROFILE,
        filtrationMode: "hepa",
        homeEnergyMode: "electric_induction",
      },
    );
    expect(boundary101.find((h) => h.id === "run_hepa_filtration")?.priority).toBe("critical");
    expect(boundary101.find((h) => h.id === "exhaust_or_induction_cook")?.priority).toBe("high");
    expect(boundary101.find((h) => h.id === "stop_indoor_combustion")?.priority).toBe("high");

    const hepaSevere = buildIndoorAirHacks(151, severeSmog, SEVERE_READINGS, {
      ...BASE_PROFILE,
      filtrationMode: "hepa",
      homeEnergyMode: "electric_induction",
    });
    expect(hepaSevere.find((h) => h.id === "run_hepa_filtration")?.priority).toBe("critical");
    expect(hepaSevere.find((h) => h.id === "seal_smog_drafts")?.priority).toBe("critical");

    const cleanSmog = assessWinterSmog(30, CLEAN_READINGS);
    const cleanHacks = buildIndoorAirHacks(30, cleanSmog, CLEAN_READINGS, {
      ...BASE_PROFILE,
      filtrationMode: "diy_box_fan",
      homeEnergyMode: "electric_induction",
    });
    expect(cleanHacks.map((h) => h.id)).toContain("timed_window_purge");
    expect(cleanHacks.find((h) => h.id === "wet_mop_dust")?.priority).toBe("standard");
    expect(cleanHacks.find((h) => h.id === "build_diy_box_filter")?.priority).toBe("high");
  });
});

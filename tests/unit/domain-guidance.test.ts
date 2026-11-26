import { describe, expect, it } from "vitest";
import { assessWinterSmog } from "@/domain/aqi";
import { buildIndoorAirHacks, buildPersonaGuidance } from "@/domain/guidance";
import type {
  HourlyForecastPoint,
  PersonaId,
  PollutantReadings,
  ResidentProfile,
} from "@/domain/types";

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
      const cleanGuidance = buildPersonaGuidance(
        35,
        cleanSmog,
        CLEAN_READINGS,
        { ...BASE_PROFILE, persona },
        HOURLY_SAMPLE,
      );
      expect(cleanGuidance.maskAdvice).toBe("none_needed");
      expect(cleanGuidance.windowsAdvice).toBe("open_cross_ventilation");

      const severeGuidance = buildPersonaGuidance(
        205,
        severeSmog,
        SEVERE_READINGS,
        { ...BASE_PROFILE, persona },
        HOURLY_SAMPLE,
      );
      expect(severeGuidance.maskAdvice).toBe("n95_required");
      expect(severeGuidance.windowsAdvice).toBe("keep_sealed");
      expect(severeGuidance.highSensitivityWarning).toBe(true);
    }
  });

  it("differentiates moderate vs sensitive AQI tiers and recommends cleaner window hours", () => {
    const modReadings = { ...CLEAN_READINGS, pm25: 28 };
    const modSmog = assessWinterSmog(85, modReadings);

    const asthmaModerate = buildPersonaGuidance(
      85,
      modSmog,
      modReadings,
      { ...BASE_PROFILE, persona: "asthma" },
      HOURLY_SAMPLE,
    );
    expect(asthmaModerate.maskAdvice).toBe("optional_sensitive");
    expect(asthmaModerate.windowsAdvice).toBe("brief_clean_window");
    expect(asthmaModerate.recommendedWindowIso).toBe("2026-11-26T15:00:00Z");

    const generalModerate = buildPersonaGuidance(
      85,
      modSmog,
      modReadings,
      BASE_PROFILE,
      HOURLY_SAMPLE,
    );
    expect(generalModerate.maskAdvice).toBe("none_needed");
    expect(generalModerate.outdoorAdvice).toBe("normal_outdoor");

    const sensitiveSmog = assessWinterSmog(135, { ...CLEAN_READINGS, pm25: 48 });
    const workerSensitive = buildPersonaGuidance(
      135,
      sensitiveSmog,
      { ...CLEAN_READINGS, pm25: 48 },
      { ...BASE_PROFILE, persona: "worker" },
      HOURLY_SAMPLE,
    );
    expect(workerSensitive.maskAdvice).toBe("n95_recommended");
    expect(workerSensitive.outdoorAdvice).toBe("pace_outdoors");

    const generalUnhealthy = buildPersonaGuidance(
      175,
      assessWinterSmog(175, { ...CLEAN_READINGS, pm25: 75 }),
      { ...CLEAN_READINGS, pm25: 75, o3: 115 },
      BASE_PROFILE,
      HOURLY_SAMPLE,
    );
    expect(generalUnhealthy.outdoorAdvice).toBe("shift_indoors");
    expect(generalUnhealthy.checklistKeys).toContain("ozone_avoid_afternoon_peak");

    const asthmaSensitive = buildPersonaGuidance(
      135,
      sensitiveSmog,
      { ...CLEAN_READINGS, pm25: 48 },
      { ...BASE_PROFILE, persona: "asthma" },
      HOURLY_SAMPLE,
    );
    expect(asthmaSensitive.outdoorAdvice).toBe("shift_indoors");

    const asthmaUnhealthy = buildPersonaGuidance(
      175,
      assessWinterSmog(175, { ...CLEAN_READINGS, pm25: 75 }),
      { ...CLEAN_READINGS, pm25: 75 },
      { ...BASE_PROFILE, persona: "asthma" },
      HOURLY_SAMPLE,
    );
    expect(asthmaUnhealthy.outdoorAdvice).toBe("avoid_outdoors");
  });

  it("handles empty hourly forecast gracefully for clean window selection", () => {
    const smog = assessWinterSmog(115, { ...CLEAN_READINGS, pm25: 41 });
    const guidance = buildPersonaGuidance(
      115,
      smog,
      { ...CLEAN_READINGS, pm25: 41 },
      BASE_PROFILE,
      [],
    );
    expect(guidance.recommendedWindowIso).toBeUndefined();
  });

  it("selects contextual indoor air quality hacks based on smog, filtration, and cooking energy", () => {
    const severeSmog = assessWinterSmog(210, SEVERE_READINGS);
    const noFilterHacks = buildIndoorAirHacks(210, severeSmog, SEVERE_READINGS, BASE_PROFILE);
    expect(noFilterHacks.map((h) => h.id)).toContain("seal_smog_drafts");
    expect(noFilterHacks.map((h) => h.id)).toContain("build_diy_box_filter");
    expect(noFilterHacks.map((h) => h.id)).toContain("exhaust_or_induction_cook");

    const hepaModerate = buildIndoorAirHacks(
      85,
      assessWinterSmog(85, CLEAN_READINGS),
      CLEAN_READINGS,
      {
        ...BASE_PROFILE,
        filtrationMode: "hepa",
        homeEnergyMode: "electric_induction",
      },
    );
    expect(hepaModerate.map((h) => h.id)).toContain("run_hepa_filtration");
    expect(hepaModerate.map((h) => h.id)).not.toContain("build_diy_box_filter");
    expect(hepaModerate.find((h) => h.id === "run_hepa_filtration")?.priority).toBe("high");

    const hepaSevere = buildIndoorAirHacks(210, severeSmog, SEVERE_READINGS, {
      ...BASE_PROFILE,
      filtrationMode: "hepa",
      homeEnergyMode: "electric_induction",
    });
    expect(hepaSevere.find((h) => h.id === "run_hepa_filtration")?.priority).toBe("critical");

    const cleanSmog = assessWinterSmog(30, CLEAN_READINGS);
    const cleanHacks = buildIndoorAirHacks(30, cleanSmog, CLEAN_READINGS, {
      ...BASE_PROFILE,
      filtrationMode: "diy_box_fan",
      homeEnergyMode: "electric_induction",
    });
    expect(cleanHacks.map((h) => h.id)).toContain("timed_window_purge");
  });
});

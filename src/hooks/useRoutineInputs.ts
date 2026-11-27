// ============================================================================
// src/hooks/useRoutineInputs.ts
// Manages interactive routine toggle state and direct exposure/CO2 calculations.
// ============================================================================

"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { assessWinterSmog } from "@/domain/aqi";
import { calculateDirectImpact } from "@/domain/impact";
import { scoreActivityWindows } from "@/domain/planner";
import { buildRoutinesAndAlternatives } from "@/domain/routines";
import {
  COMMUTE_DEFAULT_KM,
  COMMUTE_MAX_KM,
  OUTDOOR_DEFAULT_HOURS,
  OUTDOOR_MAX_HOURS,
} from "@/lib/constants";
import type { AirQualityReport } from "@/types/air-quality";
import type { ResidentProfile } from "@/types/guidance";

interface RoutineSwitchState {
  readonly swapCarToCleanTransit: boolean;
  readonly shiftActivityToBestWindow: boolean;
  readonly wearFittedN95Outdoors: boolean;
  readonly useCleanCookingAndExhaust: boolean;
  readonly runIndoorAirFiltration: boolean;
}

const DEFAULT_SWITCHES: RoutineSwitchState = {
  swapCarToCleanTransit: true,
  shiftActivityToBestWindow: true,
  wearFittedN95Outdoors: true,
  useCleanCookingAndExhaust: true,
  runIndoorAirFiltration: true,
};

const SWITCH_KEYS: readonly (keyof RoutineSwitchState)[] = [
  "swapCarToCleanTransit",
  "shiftActivityToBestWindow",
  "wearFittedN95Outdoors",
  "useCleanCookingAndExhaust",
  "runIndoorAirFiltration",
];

function clampFinite(value: number, max: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : 0;
}

function buildRoutineToggles(
  switches: RoutineSwitchState,
  setSwitches: Dispatch<SetStateAction<RoutineSwitchState>>,
) {
  return SWITCH_KEYS.map((key) => ({
    key,
    checked: switches[key],
    setter: (next: boolean) => {
      setSwitches((prev) => ({ ...prev, [key]: next }));
    },
  }));
}

interface RoutineComputationConfig {
  readonly commuteDistanceKm: number;
  readonly outdoorHours: number;
  readonly switches: RoutineSwitchState;
}

function useComputedRoutinesAndImpact(
  report: AirQualityReport,
  profile: ResidentProfile,
  config: RoutineComputationConfig,
) {
  const { commuteDistanceKm, outdoorHours, switches } = config;
  const readings = report.current.readings;
  const currentUsAqi = report.current.usAqi;
  const walkPlan = useMemo(
    () => scoreActivityWindows(report.hourly, "walk", profile.persona),
    [report.hourly, profile.persona],
  );
  const bestWindowIso = walkPlan.bestWindow?.timeIso;
  const bestWindowPm25 = walkPlan.bestWindow?.pm25 ?? readings.pm25;

  const routines = useMemo(() => {
    const smog = assessWinterSmog(currentUsAqi, readings);
    return buildRoutinesAndAlternatives({
      usAqi: currentUsAqi,
      smog,
      readings,
      profile,
      bestWindowHourIso: bestWindowIso,
    });
  }, [currentUsAqi, readings, profile, bestWindowIso]);

  const impact = useMemo(
    () =>
      calculateDirectImpact(
        { commuteDistanceKm, ...switches, outdoorHours, bestWindowPm25UgM3: bestWindowPm25 },
        readings,
        profile,
      ),
    [commuteDistanceKm, switches, outdoorHours, bestWindowPm25, readings, profile],
  );

  return { routines, impact };
}

/**
 * Manages interactive routine swaps, commute/outdoor sliders, and direct impact calculations.
 */
export function useRoutineInputs(report: AirQualityReport, profile: ResidentProfile) {
  const [commuteDistanceKm, setCommuteDistanceKm] = useState(COMMUTE_DEFAULT_KM);
  const [outdoorHours, setOutdoorHours] = useState(OUTDOOR_DEFAULT_HOURS);
  const [switches, setSwitches] = useState<RoutineSwitchState>(DEFAULT_SWITCHES);
  const { routines, impact } = useComputedRoutinesAndImpact(report, profile, {
    commuteDistanceKm,
    outdoorHours,
    switches,
  });

  return {
    routines,
    impact,
    commuteDistanceKm,
    outdoorHours,
    setCommuteDistanceKm: (val: number) => {
      setCommuteDistanceKm(clampFinite(val, COMMUTE_MAX_KM));
    },
    setOutdoorHours: (val: number) => {
      setOutdoorHours(clampFinite(val, OUTDOOR_MAX_HOURS));
    },
    toggles: buildRoutineToggles(switches, setSwitches),
  };
}

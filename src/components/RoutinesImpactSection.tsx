"use client";

import { useTranslations } from "next-intl";
import { CommuteControls } from "@/components/CommuteControls";
import { ImpactSummary } from "@/components/ImpactSummary";
import { RoutineList } from "@/components/RoutineList";
import type { AirQualityReport, ResidentProfile } from "@/domain/types";
import { useRoutineInputs } from "@/hooks/useRoutineInputs";

interface RoutinesImpactSectionProps {
  readonly report: AirQualityReport;
  readonly profile: ResidentProfile;
}

/**
 * Orchestrates low-emission daily routines and direct exposure/emissions impact simulation.
 */
export function RoutinesImpactSection({ report, profile }: RoutinesImpactSectionProps) {
  const t = useTranslations("routines");
  const {
    routines,
    impact,
    commuteDistanceKm,
    outdoorHours,
    setCommuteDistanceKm,
    setOutdoorHours,
    toggles,
  } = useRoutineInputs(report, profile);

  return (
    <section
      id="routines"
      className="space-y-6 rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6"
    >
      <RoutineList routines={routines} />

      <div className="rounded-xl border-2 border-borderc bg-surface p-4 sm:p-5">
        <h3 className="text-lg font-bold text-ink">{t("simulatorTitle")}</h3>
        <p className="mt-1 text-sm text-ink-muted">{t("simulatorDesc")}</p>

        <CommuteControls
          commuteDistanceKm={commuteDistanceKm}
          outdoorHours={outdoorHours}
          onChangeDistance={setCommuteDistanceKm}
          onChangeOutdoorHours={setOutdoorHours}
          toggles={toggles}
        />

        <ImpactSummary impact={impact} />
      </div>
    </section>
  );
}

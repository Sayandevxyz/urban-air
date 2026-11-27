// ============================================================================
// src/components/RoutinesImpactSection.tsx
// Combines tailored low-emission routines with the direct impact simulator.
// ============================================================================

"use client";

import { useTranslations } from "next-intl";
import { ImpactSimulator } from "@/components/ImpactSimulator";
import { useRoutineInputs } from "@/hooks/useRoutineInputs";
import type { AirQualityReport } from "@/types/air-quality";
import type { ResidentProfile, RoutineAlternative } from "@/types/guidance";

function RoutineList({ routines }: { readonly routines: readonly RoutineAlternative[] }) {
  const t = useTranslations("routines");

  return (
    <div>
      <h2 id="routines-heading" className="text-xl font-bold text-ink">
        {t("sectionTitle")}
      </h2>
      <h3 className="mt-4 text-lg font-bold text-ink">{t("routinesTitle")}</h3>

      <ul className="mt-3 grid gap-4 md:grid-cols-2">
        {routines.map((routine) => (
          <li key={routine.id} className="rounded-lg border border-borderc bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-base font-bold text-ink">{t(`items.${routine.id}.title`)}</h4>
              <span className="shrink-0 rounded-full border border-borderc-strong px-2.5 py-0.5 text-xs font-bold text-ink">
                {routine.priority === "high" ? t("priorityHigh") : t("priorityMedium")}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-muted">{t(`items.${routine.id}.desc`)}</p>
            <p className="mt-2 rounded bg-surface-muted p-2 text-xs font-semibold text-ink">
              {t(`items.${routine.id}.whyImpact`)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Orchestrates low-emission daily routines and direct exposure/emissions impact simulation.
 */
export function RoutinesImpactSection({
  report,
  profile,
}: {
  readonly report: AirQualityReport;
  readonly profile: ResidentProfile;
}) {
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

        <ImpactSimulator
          commuteDistanceKm={commuteDistanceKm}
          outdoorHours={outdoorHours}
          onChangeDistance={setCommuteDistanceKm}
          onChangeOutdoorHours={setOutdoorHours}
          toggles={toggles}
          impact={impact}
        />
      </div>
    </section>
  );
}

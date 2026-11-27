// ============================================================================
// src/components/RoutinesImpactSection.tsx
// Combines tailored low-emission routines with the direct impact simulator.
// ============================================================================

"use client";

import { useTranslations } from "next-intl";
import { NumericField, SectionCard, TONE_SURFACE_CLASSES } from "@/components/UiPrimitives";
import { useRoutineInputs } from "@/hooks/useRoutineInputs";
import { COMMUTE_MAX_KM, OUTDOOR_MAX_HOURS } from "@/lib/constants";
import type { AirQualityReport } from "@/types/air-quality";
import type { DirectImpactResult, ResidentProfile, RoutineAlternative } from "@/types/guidance";

const OUTDOOR_HOURS_STEP = 0.5;

interface RoutineToggleItem {
  readonly key: string;
  readonly checked: boolean;
  readonly setter: (next: boolean) => void;
}

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

function ImpactToggleList({ toggles }: { readonly toggles: readonly RoutineToggleItem[] }) {
  const t = useTranslations("routines");
  return (
    <div className="mt-4 space-y-2">
      {toggles.map(({ key, checked, setter }) => (
        <div key={key} className="flex min-h-[44px] items-center gap-3">
          <input
            id={`toggle-${key}`}
            type="checkbox"
            checked={checked}
            onChange={(event) => {
              setter(event.target.checked);
            }}
            className="h-5 w-5 shrink-0 accent-accent"
          />
          <label htmlFor={`toggle-${key}`} className="text-sm font-medium text-ink">
            {t(`toggles.${key}`)}
          </label>
        </div>
      ))}
    </div>
  );
}

function ImpactKpiCards({ impact }: { readonly impact: DirectImpactResult }) {
  const t = useTranslations("routines");
  const communityStats = [
    ["communityCo2Label", `${impact.communityCo2SavedGrams} g`],
    ["communityNoxLabel", `${impact.communityNoxSavedGrams} g`],
  ] as const;
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-3" aria-live="polite">
      <div className={`rounded-lg p-4 ${TONE_SURFACE_CLASSES.emerald}`}>
        <p className="text-xs font-bold uppercase tracking-wide">{t("personalSavedLabel")}</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums">
          {impact.personalPm25AvoidedUg} µg ({impact.personalReductionPercent}%)
        </p>
      </div>
      {communityStats.map(([labelKey, formatted]) => (
        <div key={labelKey} className="rounded-lg border border-borderc bg-surface-elevated p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t(labelKey)}</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-ink">{formatted}</p>
        </div>
      ))}
    </div>
  );
}

function ImpactSummaryMetrics({ impact }: { readonly impact: DirectImpactResult }) {
  const t = useTranslations("routines");
  return (
    <>
      <ImpactKpiCards impact={impact} />
      <ul className="mt-3 grid gap-2 text-xs text-ink-muted sm:grid-cols-2 lg:grid-cols-3">
        {impact.breakdown.map((item) => (
          <li key={item.id} className="rounded border border-borderc bg-surface-elevated px-3 py-2">
            <span className="font-semibold text-ink">{t(`breakdownLabels.${item.id}`)}: </span>
            <span>
              {item.pm25AvoidedUg > 0
                ? `-${item.pm25AvoidedUg} µg PM2.5`
                : `${item.co2SavedGrams} g CO2e`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-muted">{t("impactFormulaNote")}</p>
    </>
  );
}

/** Orchestrates low-emission daily routines and direct exposure/emissions impact simulation. */
export function RoutinesImpactSection({
  report,
  profile,
}: {
  readonly report: AirQualityReport;
  readonly profile: ResidentProfile;
}) {
  const t = useTranslations("routines");
  const s = useRoutineInputs(report, profile);
  return (
    <SectionCard id="routines" className="space-y-6">
      <RoutineList routines={s.routines} />
      <div className="rounded-xl border-2 border-borderc bg-surface p-4 sm:p-5">
        <h3 className="text-lg font-bold text-ink">{t("simulatorTitle")}</h3>
        <p className="mt-1 text-sm text-ink-muted">{t("simulatorDesc")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <NumericField
            id="impact-distance-input"
            label={t("distanceLabel")}
            max={COMMUTE_MAX_KM}
            step={1}
            value={s.commuteDistanceKm}
            surfaceClassName="bg-surface-elevated"
            onChange={(val) => {
              s.setCommuteDistanceKm(Number(val));
            }}
          />
          <NumericField
            id="impact-hours-input"
            label={t("outdoorHoursLabel")}
            max={OUTDOOR_MAX_HOURS}
            step={OUTDOOR_HOURS_STEP}
            value={s.outdoorHours}
            surfaceClassName="bg-surface-elevated"
            onChange={(val) => {
              s.setOutdoorHours(Number(val));
            }}
          />
        </div>
        <ImpactToggleList toggles={s.toggles} />
        <ImpactSummaryMetrics impact={s.impact} />
      </div>
    </SectionCard>
  );
}

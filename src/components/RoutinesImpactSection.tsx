"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { assessWinterSmog } from "@/domain/aqi";
import { calculateDirectImpact } from "@/domain/impact";
import { scoreActivityWindows } from "@/domain/planner";
import { buildRoutinesAndAlternatives } from "@/domain/routines";
import type { AirQualityReport, ImpactChoiceInput, ResidentProfile } from "@/domain/types";

interface RoutinesImpactSectionProps {
  readonly report: AirQualityReport;
  readonly profile: ResidentProfile;
}

/**
 * Presents location- and lifestyle-tailored low-emission daily routines plus an interactive
 * direct-impact calculator quantifying personal PM2.5 avoided and community CO2/NOx saved.
 */
export function RoutinesImpactSection({ report, profile }: RoutinesImpactSectionProps) {
  const t = useTranslations("routines");
  const { usAqi, readings } = report.current;
  const walkPlan = useMemo(
    () => scoreActivityWindows(report.hourly, "walk", profile.persona),
    [report.hourly, profile.persona],
  );
  const bestWindowIso = walkPlan.bestWindow?.timeIso;
  const bestWindowPm25 = walkPlan.bestWindow?.pm25 ?? readings.pm25;

  const routines = useMemo(() => {
    const smog = assessWinterSmog(usAqi, readings);
    return buildRoutinesAndAlternatives(usAqi, smog, readings, profile, bestWindowIso);
  }, [usAqi, readings, profile, bestWindowIso]);

  const [commuteDistanceKm, setCommuteDistanceKm] = useState(10);
  const [outdoorHours, setOutdoorHours] = useState(1.5);
  const [swapCarToCleanTransit, setSwapCarToCleanTransit] = useState(true);
  const [shiftActivityToBestWindow, setShiftActivityToBestWindow] = useState(true);
  const [wearFittedN95Outdoors, setWearFittedN95Outdoors] = useState(true);
  const [useCleanCookingAndExhaust, setUseCleanCookingAndExhaust] = useState(true);
  const [runIndoorAirFiltration, setRunIndoorAirFiltration] = useState(true);

  const impact = useMemo(() => {
    const impactInput: ImpactChoiceInput = {
      commuteDistanceKm,
      swapCarToCleanTransit,
      shiftActivityToBestWindow,
      wearFittedN95Outdoors,
      useCleanCookingAndExhaust,
      runIndoorAirFiltration,
      outdoorHours,
      bestWindowPm25UgM3: bestWindowPm25,
    };
    return calculateDirectImpact(impactInput, readings, profile);
  }, [
    commuteDistanceKm,
    swapCarToCleanTransit,
    shiftActivityToBestWindow,
    wearFittedN95Outdoors,
    useCleanCookingAndExhaust,
    runIndoorAirFiltration,
    outdoorHours,
    bestWindowPm25,
    readings,
    profile,
  ]);

  return (
    <section
      id="routines"
      aria-labelledby="routines-heading"
      className="space-y-6 rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6"
    >
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

      <div className="rounded-xl border-2 border-borderc bg-surface p-4 sm:p-5">
        <h3 className="text-lg font-bold text-ink">{t("simulatorTitle")}</h3>
        <p className="mt-1 text-sm text-ink-muted">{t("simulatorDesc")}</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="impact-distance-input" className="block text-sm font-semibold text-ink">
              {t("distanceLabel")}
            </label>
            <input
              id="impact-distance-input"
              type="number"
              min={0}
              max={150}
              step={1}
              value={commuteDistanceKm}
              onChange={(event) => {
                const val = Number(event.target.value);
                setCommuteDistanceKm(Number.isFinite(val) ? Math.max(0, Math.min(150, val)) : 0);
              }}
              className="mt-1 min-h-[48px] w-full rounded-lg border-2 border-borderc-strong bg-surface-elevated px-3 py-2 text-base text-ink"
            />
          </div>

          <div>
            <label htmlFor="impact-hours-input" className="block text-sm font-semibold text-ink">
              {t("outdoorHoursLabel")}
            </label>
            <input
              id="impact-hours-input"
              type="number"
              min={0}
              max={12}
              step={0.5}
              value={outdoorHours}
              onChange={(event) => {
                const val = Number(event.target.value);
                setOutdoorHours(Number.isFinite(val) ? Math.max(0, Math.min(12, val)) : 0);
              }}
              className="mt-1 min-h-[48px] w-full rounded-lg border-2 border-borderc-strong bg-surface-elevated px-3 py-2 text-base text-ink"
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {(
            [
              ["swapCarToCleanTransit", swapCarToCleanTransit, setSwapCarToCleanTransit],
              [
                "shiftActivityToBestWindow",
                shiftActivityToBestWindow,
                setShiftActivityToBestWindow,
              ],
              ["wearFittedN95Outdoors", wearFittedN95Outdoors, setWearFittedN95Outdoors],
              [
                "useCleanCookingAndExhaust",
                useCleanCookingAndExhaust,
                setUseCleanCookingAndExhaust,
              ],
              ["runIndoorAirFiltration", runIndoorAirFiltration, setRunIndoorAirFiltration],
            ] as const
          ).map(([key, checked, setter]) => (
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

        <div className="mt-5 grid gap-4 md:grid-cols-3" aria-live="polite">
          <div className="rounded-lg border-2 border-emerald-700 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-100">
            <p className="text-xs font-bold uppercase tracking-wide">{t("personalSavedLabel")}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">
              {impact.personalPm25AvoidedUg} µg ({impact.personalReductionPercent}%)
            </p>
          </div>
          <div className="rounded-lg border border-borderc bg-surface-elevated p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              {t("communityCo2Label")}
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-ink">
              {impact.communityCo2SavedGrams} g
            </p>
          </div>
          <div className="rounded-lg border border-borderc bg-surface-elevated p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              {t("communityNoxLabel")}
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-ink">
              {impact.communityNoxSavedGrams} g
            </p>
          </div>
        </div>

        <ul className="mt-3 grid gap-2 text-xs text-ink-muted sm:grid-cols-2 lg:grid-cols-3">
          {impact.breakdown.map((item) => (
            <li
              key={item.id}
              className="rounded border border-borderc bg-surface-elevated px-3 py-2"
            >
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
      </div>
    </section>
  );
}

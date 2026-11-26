"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { scoreActivityWindows } from "@/domain/planner";
import type { ActivityType, AirQualityReport, PersonaId } from "@/domain/types";

interface ActivityPlannerProps {
  readonly report: AirQualityReport;
  readonly persona: PersonaId;
}

const ACTIVITIES: readonly ActivityType[] = ["run", "cycle", "walk", "ventilate"];

/**
 * Recommends optimal daily windows for outdoor activities and ventilation with O(n) score breakdown.
 */
export function ActivityPlanner({ report, persona }: ActivityPlannerProps) {
  const t = useTranslations("planner");
  const [activity, setActivity] = useState<ActivityType>("run");

  const plan = useMemo(
    () => scoreActivityWindows(report.hourly, activity, persona),
    [report.hourly, activity, persona],
  );

  return (
    <section
      aria-labelledby="planner-heading"
      className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="planner-heading" className="text-xl font-bold text-ink">
          {t("sectionTitle")}
        </h2>

        <div role="group" aria-label={t("activityLabel")} className="flex flex-wrap gap-2">
          {ACTIVITIES.map((item) => {
            const selected = activity === item;
            return (
              <button
                key={item}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setActivity(item);
                }}
                className={`min-h-[44px] rounded-lg border-2 px-4 py-2 text-sm font-semibold ${
                  selected
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-borderc bg-surface text-ink hover:bg-surface-muted"
                }`}
              >
                {t(`activities.${item}`)}
              </button>
            );
          })}
        </div>
      </div>

      {plan.bestWindow && plan.worstWindow && (
        <div className="mt-5 grid gap-4 md:grid-cols-2" aria-live="polite">
          <div className="rounded-lg border-2 border-emerald-700 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-100">
            <h3 className="text-sm font-bold uppercase tracking-wide">{t("bestWindowTitle")}</h3>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">
              {plan.bestWindow.timeIso.slice(11, 16)} UTC
            </p>
            <p className="mt-1 text-base font-bold">
              {t("scoreLabel", { score: plan.bestWindow.score })}
            </p>
            <p className="mt-1 text-sm">
              US AQI {plan.bestWindow.usAqi} · PM2.5 {plan.bestWindow.pm25} µg/m³
            </p>
            <ul className="mt-2 space-y-0.5 text-xs">
              <li>{t("aqiPenalty", { value: plan.bestWindow.aqiPenalty })}</li>
              <li>{t("pollutantPenalty", { value: plan.bestWindow.pollutantPenalty })}</li>
              <li>
                {t("timingBonus", {
                  value:
                    plan.bestWindow.timeSuitabilityBonus >= 0
                      ? `+${plan.bestWindow.timeSuitabilityBonus}`
                      : String(plan.bestWindow.timeSuitabilityBonus),
                })}
              </li>
            </ul>
          </div>

          <div className="rounded-lg border-2 border-rose-700 bg-rose-50 p-4 text-rose-950 dark:border-rose-400 dark:bg-rose-950/60 dark:text-rose-100">
            <h3 className="text-sm font-bold uppercase tracking-wide">{t("worstWindowTitle")}</h3>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">
              {plan.worstWindow.timeIso.slice(11, 16)} UTC
            </p>
            <p className="mt-1 text-base font-bold">
              {t("scoreLabel", { score: plan.worstWindow.score })}
            </p>
            <p className="mt-1 text-sm">
              US AQI {plan.worstWindow.usAqi} · PM2.5 {plan.worstWindow.pm25} µg/m³
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-borderc bg-surface p-3 text-sm text-ink-muted">
        <p className="font-semibold text-ink">{t("formulaTitle")}</p>
        <p className="mt-1">{t("formulaDesc")}</p>
      </div>
    </section>
  );
}

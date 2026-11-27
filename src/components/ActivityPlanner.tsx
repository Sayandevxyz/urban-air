// ============================================================================
// src/components/ActivityPlanner.tsx
// Renders transparent O(n) best/worst time windows for outdoor activities.
// ============================================================================

"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { scoreActivityWindows } from "@/domain/planner";
import { ISO_SLICE } from "@/lib/constants";
import type { AirQualityReport } from "@/types/air-quality";
import type { ActivityScorePoint, ActivityType, PersonaId } from "@/types/guidance";

interface ActivityPlannerProps {
  readonly report: AirQualityReport;
  readonly persona: PersonaId;
}

const ACTIVITIES: readonly ActivityType[] = ["run", "cycle", "walk", "ventilate"];

function ActivitySelector({
  activity,
  onSelect,
}: {
  readonly activity: ActivityType;
  readonly onSelect: (next: ActivityType) => void;
}) {
  const t = useTranslations("planner");
  return (
    <div role="group" aria-label={t("activityLabel")} className="flex flex-wrap gap-2">
      {ACTIVITIES.map((item) => {
        const selected = activity === item;
        return (
          <button
            key={item}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              onSelect(item);
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
  );
}

function WindowExtremeCard({
  variant,
  windowPoint,
}: {
  readonly variant: "best" | "worst";
  readonly windowPoint: ActivityScorePoint;
}) {
  const t = useTranslations("planner");
  const isBest = variant === "best";
  const cardClasses = isBest
    ? "rounded-lg border-2 border-emerald-700 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-100"
    : "rounded-lg border-2 border-rose-700 bg-rose-50 p-4 text-rose-950 dark:border-rose-400 dark:bg-rose-950/60 dark:text-rose-100";

  return (
    <div className={cardClasses}>
      <h3 className="text-sm font-bold uppercase tracking-wide">
        {isBest ? t("bestWindowTitle") : t("worstWindowTitle")}
      </h3>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">
        {windowPoint.timeIso.slice(ISO_SLICE.hourStart, ISO_SLICE.minuteEnd)} UTC
      </p>
      <p className="mt-1 text-base font-bold">{t("scoreLabel", { score: windowPoint.score })}</p>
      <p className="mt-1 text-sm">
        US AQI {windowPoint.usAqi} · PM2.5 {windowPoint.pm25} µg/m³
      </p>
      {isBest && (
        <ul className="mt-2 space-y-0.5 text-xs">
          <li>{t("aqiPenalty", { value: windowPoint.aqiPenalty })}</li>
          <li>{t("pollutantPenalty", { value: windowPoint.pollutantPenalty })}</li>
          <li>
            {t("timingBonus", {
              value:
                windowPoint.timeSuitabilityBonus >= 0
                  ? `+${windowPoint.timeSuitabilityBonus}`
                  : String(windowPoint.timeSuitabilityBonus),
            })}
          </li>
        </ul>
      )}
    </div>
  );
}

/** Recommends optimal daily windows for outdoor activities and ventilation with O(n) score breakdown. */
export function ActivityPlanner({ report, persona }: ActivityPlannerProps) {
  const t = useTranslations("planner");
  const [activity, setActivity] = useState<ActivityType>("run");

  const plan = useMemo(
    () => scoreActivityWindows(report.hourly, activity, persona),
    [report.hourly, activity, persona],
  );

  return (
    <section className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="planner-heading" className="text-xl font-bold text-ink">
          {t("sectionTitle")}
        </h2>
        <ActivitySelector activity={activity} onSelect={setActivity} />
      </div>

      {plan.bestWindow && plan.worstWindow && (
        <div className="mt-5 grid gap-4 md:grid-cols-2" aria-live="polite">
          <WindowExtremeCard variant="best" windowPoint={plan.bestWindow} />
          <WindowExtremeCard variant="worst" windowPoint={plan.worstWindow} />
        </div>
      )}

      <div className="mt-4 rounded-lg border border-borderc bg-surface p-3 text-sm text-ink-muted">
        <p className="font-semibold text-ink">{t("formulaTitle")}</p>
        <p className="mt-1">{t("formulaDesc")}</p>
      </div>
    </section>
  );
}

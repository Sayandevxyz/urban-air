"use client";

import { useTranslations } from "next-intl";
import { AQI_VISUAL_STYLES } from "@/components/aqiVisuals";
import { AqiSeverityIcon } from "@/components/icons/AqiIcons";
import {
  assessPollutants,
  assessWinterSmog,
  classifyUsAqi,
  computeEuropeanAqiBand,
  findDominantPollutant,
} from "@/domain/aqi";
import type { AirQualityReport } from "@/domain/types";

interface AqiDashboardProps {
  readonly report: AirQualityReport;
}

/**
 * Displays dual US/European AQI with icon+color+text badges, winter smog alerts, and WHO pollutant breakdown.
 */
export function AqiDashboard({ report }: AqiDashboardProps) {
  const tDash = useTranslations("dashboard");
  const tPol = useTranslations("pollutants");

  const usMeta = classifyUsAqi(report.current.usAqi);
  const euBand = computeEuropeanAqiBand(report.current.europeanAqi);
  const assessments = assessPollutants(report.current.readings);
  const dominant = findDominantPollutant(assessments);
  const smog = assessWinterSmog(report.current.usAqi, report.current.readings);
  const visual = AQI_VISUAL_STYLES[usMeta.category];

  const sourceLabel =
    report.source === "demo"
      ? tDash("sourceDemo")
      : report.source === "cached"
        ? tDash("sourceCached")
        : tDash("sourceOpenMeteo");

  return (
    <section id="dashboard" className="space-y-5" aria-live="polite">
      {smog.isWinterSmogAlert && (
        <div
          role="alert"
          className="rounded-xl border-2 border-rose-800 bg-rose-50 p-4 text-rose-950 shadow-sm dark:border-rose-300 dark:bg-rose-950/80 dark:text-rose-50"
        >
          <div className="flex items-start gap-3">
            <AqiSeverityIcon iconId="smog-danger" className="mt-0.5 h-6 w-6 shrink-0" />
            <div>
              <h2 className="text-lg font-bold">
                {smog.severity === "smog_emergency"
                  ? tDash("smogAlertEmergencyTitle")
                  : tDash("smogAlertSevereTitle")}
              </h2>
              <p className="mt-1 text-sm">{tDash("smogAlertBody")}</p>
              {smog.inversionTrapLikely && (
                <p className="mt-1 text-sm font-semibold">{tDash("inversionNote")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 id="dashboard-heading" className="text-xl font-bold text-ink">
              {tDash("sectionTitle")} — {report.location.name}
              {report.location.country ? `, ${report.location.country}` : ""}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {tDash("updatedAt")}: {report.updatedAtIso} · {sourceLabel}
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-borderc bg-surface px-3 py-1 text-sm font-semibold text-ink">
            {tDash("dominantPollutant")}: {tPol(`items.${dominant}.name`)}
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className={`rounded-xl border-2 p-5 ${visual.cardClass}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold uppercase tracking-wide">
                {tDash("usAqiLabel")}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${visual.badgeClass}`}
              >
                <AqiSeverityIcon iconId={usMeta.iconId} className="h-4 w-4" />
                <span>{visual.patternLabel}</span>
              </span>
            </div>
            <p className="mt-3 text-4xl font-extrabold tabular-nums">{report.current.usAqi}</p>
            <p className="mt-1 flex items-center gap-2 text-base font-bold">
              <AqiSeverityIcon iconId={usMeta.iconId} className="h-5 w-5 shrink-0" />
              <span>{tDash(`categories.${usMeta.category}`)}</span>
            </p>
          </div>

          <div className="rounded-xl border-2 border-borderc bg-surface p-5 text-ink">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                {tDash("euAqiLabel")}
              </span>
              <span className="rounded-full border border-borderc px-3 py-1 text-xs font-bold text-ink">
                EAQI
              </span>
            </div>
            <p className="mt-3 text-4xl font-extrabold tabular-nums">
              {report.current.europeanAqi}
            </p>
            <p className="mt-1 text-base font-bold text-ink">{tDash(`euBands.${euBand}`)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6">
        <h3 className="text-lg font-bold text-ink">{tPol("sectionTitle")}</h3>
        <p className="mt-1 text-sm text-ink-muted">{tPol("sectionDesc")}</p>

        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assessments.map((item) => {
            const fillPct = Math.min(100, Math.round(item.whoRatio * 25));
            return (
              <li
                key={item.key}
                className={`rounded-lg border p-4 ${
                  item.exceedsWho
                    ? "border-amber-700 bg-amber-50/40 dark:border-amber-400 dark:bg-amber-950/30"
                    : "border-borderc bg-surface"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-base font-bold text-ink">{tPol(`items.${item.key}.name`)}</h4>
                  <span className="shrink-0 text-base font-extrabold tabular-nums text-ink">
                    {item.valueUgM3} {tPol("unitUgM3")}
                  </span>
                </div>

                <p className="mt-1 text-xs font-semibold text-ink-muted">
                  {tPol("whoLimitLabel", { limit: item.whoGuidelineUgM3 })} ·{" "}
                  <span className="font-bold text-ink">
                    {tPol("whoRatioText", { ratio: item.whoRatio })}
                  </span>
                </p>

                <div
                  className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-muted"
                  aria-hidden="true"
                >
                  <div
                    className={
                      item.exceedsWho
                        ? "h-full bg-rose-700 dark:bg-rose-400"
                        : "h-full bg-emerald-700 dark:bg-emerald-400"
                    }
                    style={{ width: `${Math.max(8, fillPct)}%` }}
                  />
                </div>

                <p className="mt-2 text-xs font-bold text-ink">
                  {item.exceedsWho ? tPol("exceedsWho") : tPol("withinWho")}
                </p>
                <p className="mt-1 text-sm text-ink-muted">{tPol(`items.${item.key}.shortDesc`)}</p>
                <p className="mt-1 text-xs text-ink-muted">{tPol(`items.${item.key}.sources`)}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

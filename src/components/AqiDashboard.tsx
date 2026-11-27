"use client";

import { useTranslations } from "next-intl";
import { AQI_VISUAL_STYLES, AqiSeverityIcon } from "@/components/AqiVisuals";
import { PollutantGrid } from "@/components/PollutantGrid";
import {
  assessPollutants,
  assessWinterSmog,
  classifyUsAqi,
  computeEuropeanAqiBand,
  findDominantPollutant,
} from "@/domain/aqi";
import type { AirQualityReport, PollutantKey, SmogAssessment } from "@/types/air-quality";

function SmogAlertBanner({ smog }: { readonly smog: SmogAssessment }) {
  const tDash = useTranslations("dashboard");
  return (
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
  );
}

function AqiScaleCards({ report }: { readonly report: AirQualityReport }) {
  const tDash = useTranslations("dashboard");
  const usMeta = classifyUsAqi(report.current.usAqi);
  const euBand = computeEuropeanAqiBand(report.current.europeanAqi);
  const visual = AQI_VISUAL_STYLES[usMeta.category];

  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <div className={`rounded-xl border-2 p-5 ${visual.cardClass}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold uppercase tracking-wide">{tDash("usAqiLabel")}</span>
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
        <p className="mt-3 text-4xl font-extrabold tabular-nums">{report.current.europeanAqi}</p>
        <p className="mt-1 text-base font-bold text-ink">{tDash(`euBands.${euBand}`)}</p>
      </div>
    </div>
  );
}

function AqiHeadlineCard({
  report,
  dominant,
}: {
  readonly report: AirQualityReport;
  readonly dominant: PollutantKey;
}) {
  const tDash = useTranslations("dashboard");
  const tPol = useTranslations("pollutants");
  const sourceLabel =
    report.source === "demo"
      ? tDash("sourceDemo")
      : report.source === "cached"
        ? tDash("sourceCached")
        : tDash("sourceOpenMeteo");

  return (
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
      <AqiScaleCards report={report} />
    </div>
  );
}

/**
 * Live AQI dashboard presenting severe winter smog alerts, dual AQI scales, and WHO pollutants.
 */
export function AqiDashboard({ report }: { readonly report: AirQualityReport }) {
  const assessments = assessPollutants(report.current.readings);
  const dominant = findDominantPollutant(assessments);
  const smog = assessWinterSmog(report.current.usAqi, report.current.readings);

  return (
    <section id="dashboard" className="space-y-5" aria-live="polite">
      {smog.isWinterSmogAlert && <SmogAlertBanner smog={smog} />}
      <AqiHeadlineCard report={report} dominant={dominant} />
      <PollutantGrid assessments={assessments} />
    </section>
  );
}

// ============================================================================
// src/components/AqiDashboard.tsx
// Displays severe winter smog alerts, dual AQI scales, and WHO pollutant grid.
// ============================================================================

"use client";

import { useTranslations } from "next-intl";
import { AQI_VISUAL_STYLES, AqiSeverityIcon } from "@/components/AqiVisuals";
import {
  assessPollutants,
  assessWinterSmog,
  classifyUsAqi,
  computeEuropeanAqiBand,
  findDominantPollutant,
} from "@/domain/aqi";
import type {
  AirQualityReport,
  PollutantAssessment,
  PollutantKey,
  SmogAssessment,
} from "@/types/air-quality";

const MIN_WHO_BAR_PERCENT = 8;
const WHO_BAR_PERCENT_PER_RATIO = 25;
const WHO_BAR_HEIGHT = 10;
const WHO_BAR_CORNER_RADIUS = 5;

function SmogAlertBanner({ smog }: { readonly smog: SmogAssessment }) {
  const t = useTranslations("dashboard");
  const titleKey =
    smog.severity === "smog_emergency" ? "smogAlertEmergencyTitle" : "smogAlertSevereTitle";
  return (
    <div
      role="alert"
      className="rounded-xl border-2 border-rose-800 bg-rose-50 p-4 text-rose-950 shadow-sm dark:border-rose-300 dark:bg-rose-950/80 dark:text-rose-50"
    >
      <div className="flex items-start gap-3">
        <AqiSeverityIcon iconId="smog-danger" className="mt-0.5 h-6 w-6 shrink-0" />
        <div>
          <h2 className="text-lg font-bold">{t(titleKey)}</h2>
          <p className="mt-1 text-sm">{t("smogAlertBody")}</p>
          {smog.inversionTrapLikely && (
            <p className="mt-1 text-sm font-semibold">{t("inversionNote")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AqiScaleCards({ report }: { readonly report: AirQualityReport }) {
  const t = useTranslations("dashboard");
  const usMeta = classifyUsAqi(report.current.usAqi);
  const visual = AQI_VISUAL_STYLES[usMeta.category];
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <div className={`rounded-xl border-2 p-5 ${visual.cardClass}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold uppercase tracking-wide">{t("usAqiLabel")}</span>
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
          <span>{t(`categories.${usMeta.category}`)}</span>
        </p>
      </div>
      <div className="rounded-xl border-2 border-borderc bg-surface p-5 text-ink">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold uppercase tracking-wide text-ink-muted">
            {t("euAqiLabel")}
          </span>
          <span className="rounded-full border border-borderc px-3 py-1 text-xs font-bold text-ink">
            EAQI
          </span>
        </div>
        <p className="mt-3 text-4xl font-extrabold tabular-nums">{report.current.europeanAqi}</p>
        <p className="mt-1 text-base font-bold text-ink">
          {t(`euBands.${computeEuropeanAqiBand(report.current.europeanAqi)}`)}
        </p>
      </div>
    </div>
  );
}

const SOURCE_KEY_BY_NAME = {
  demo: "sourceDemo",
  cached: "sourceCached",
  "open-meteo": "sourceOpenMeteo",
} as const;

function AqiHeadlineCard({
  report,
  dominant,
}: {
  readonly report: AirQualityReport;
  readonly dominant: PollutantKey;
}) {
  const tDash = useTranslations("dashboard");
  const tPol = useTranslations("pollutants");
  const srcKey = SOURCE_KEY_BY_NAME[report.source];
  return (
    <div className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="dashboard-heading" className="text-xl font-bold text-ink">
            {tDash("sectionTitle")} — {report.location.name}
            {report.location.country ? `, ${report.location.country}` : ""}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {tDash("updatedAt")}: {report.updatedAtIso} · {tDash(srcKey)}
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

const BAR_BASE = "mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-muted";
const BAR_FAIL = "fill-rose-700 dark:fill-rose-400";
const BAR_OK = "fill-emerald-700 dark:fill-emerald-400";
const CARD_WARN = "border-amber-700 bg-amber-50/40 dark:border-amber-400 dark:bg-amber-950/30";
const CARD_OK = "border-borderc bg-surface";

function PollutantWhoBar({ item }: { readonly item: PollutantAssessment }) {
  const w = Math.max(
    MIN_WHO_BAR_PERCENT,
    Math.min(100, Math.round(item.whoRatio * WHO_BAR_PERCENT_PER_RATIO)),
  );
  return (
    <svg viewBox="0 0 100 10" preserveAspectRatio="none" className={BAR_BASE} aria-hidden="true">
      <rect
        x={0}
        y={0}
        width={w}
        height={WHO_BAR_HEIGHT}
        rx={WHO_BAR_CORNER_RADIUS}
        className={item.exceedsWho ? BAR_FAIL : BAR_OK}
      />
    </svg>
  );
}

function PollutantCard({ item }: { readonly item: PollutantAssessment }) {
  const tPol = useTranslations("pollutants");
  return (
    <li className={`rounded-lg border p-4 ${item.exceedsWho ? CARD_WARN : CARD_OK}`}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-base font-bold text-ink">{tPol(`items.${item.key}.name`)}</h4>
        <span className="shrink-0 text-base font-extrabold tabular-nums text-ink">
          {item.valueUgM3} {tPol("unitUgM3")}
        </span>
      </div>
      <p className="mt-1 text-xs font-semibold text-ink-muted">
        {tPol("whoLimitLabel", { limit: item.whoGuidelineUgM3 })} ·{" "}
        <span className="font-bold text-ink">{tPol("whoRatioText", { ratio: item.whoRatio })}</span>
      </p>
      <PollutantWhoBar item={item} />
      <p className="mt-2 text-xs font-bold text-ink">
        {tPol(item.exceedsWho ? "exceedsWho" : "withinWho")}
      </p>
      <p className="mt-1 text-sm text-ink-muted">{tPol(`items.${item.key}.shortDesc`)}</p>
      <p className="mt-1 text-xs text-ink-muted">{tPol(`items.${item.key}.sources`)}</p>
    </li>
  );
}

/** Live AQI dashboard presenting severe winter smog alerts, dual AQI scales, and WHO pollutants. */
export function AqiDashboard({ report }: { readonly report: AirQualityReport }) {
  const tPol = useTranslations("pollutants");
  const assessments = assessPollutants(report.current.readings);
  const dominant = findDominantPollutant(assessments);
  const smog = assessWinterSmog(report.current.usAqi, report.current.readings);
  return (
    <section id="dashboard" className="space-y-5" aria-live="polite">
      {smog.isWinterSmogAlert && <SmogAlertBanner smog={smog} />}
      <AqiHeadlineCard report={report} dominant={dominant} />
      <div className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6">
        <h3 className="text-lg font-bold text-ink">{tPol("sectionTitle")}</h3>
        <p className="mt-1 text-sm text-ink-muted">{tPol("sectionDesc")}</p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assessments.map((item) => (
            <PollutantCard key={item.key} item={item} />
          ))}
        </ul>
      </div>
    </section>
  );
}

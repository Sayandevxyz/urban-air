import { useTranslations } from "next-intl";
import type { DirectImpactResult } from "@/domain/types";

interface ImpactSummaryProps {
  readonly impact: DirectImpactResult;
}

/**
 * Displays quantitative personal PM2.5 avoided and community CO2e/NOx reductions.
 */
export function ImpactSummary({ impact }: ImpactSummaryProps) {
  const t = useTranslations("routines");

  return (
    <>
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

import { useTranslations } from "next-intl";
import type { PollutantAssessment } from "@/types/air-quality";

interface PollutantGridProps {
  readonly assessments: readonly PollutantAssessment[];
}

/**
 * Displays the six criteria pollutants against WHO 2021 limits with plain-language descriptions.
 */
export function PollutantGrid({ assessments }: PollutantGridProps) {
  const tPol = useTranslations("pollutants");

  return (
    <div className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6">
      <h3 className="text-lg font-bold text-ink">{tPol("sectionTitle")}</h3>
      <p className="mt-1 text-sm text-ink-muted">{tPol("sectionDesc")}</p>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {assessments.map((item) => {
          const fillPct = Math.max(8, Math.min(100, Math.round(item.whoRatio * 25)));
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
              <svg
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
                className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-muted"
                aria-hidden="true"
              >
                <rect
                  x={0}
                  y={0}
                  width={fillPct}
                  height={10}
                  rx={5}
                  className={
                    item.exceedsWho
                      ? "fill-rose-700 dark:fill-rose-400"
                      : "fill-emerald-700 dark:fill-emerald-400"
                  }
                />
              </svg>
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
  );
}

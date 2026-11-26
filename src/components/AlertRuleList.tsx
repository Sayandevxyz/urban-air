import { useTranslations } from "next-intl";
import type { ThresholdAlertRule } from "@/domain/types";

interface AlertRuleListProps {
  readonly rules: readonly ThresholdAlertRule[];
  readonly onToggleRule: (ruleId: string) => void;
  readonly onRemoveRule: (ruleId: string) => void;
}

/**
 * Displays saved local alert rules with accessible enable/pause toggle and delete controls.
 */
export function AlertRuleList({ rules, onToggleRule, onRemoveRule }: AlertRuleListProps) {
  const t = useTranslations("alerts");

  return (
    <div className="mt-5" aria-live="polite">
      {rules.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("noRules")}</p>
      ) : (
        <ul className="space-y-2">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-borderc bg-surface px-4 py-3 text-sm"
            >
              <span className="font-semibold text-ink">
                {rule.cityName} · {rule.metric === "usAqi" ? t("metricUsAqi") : t("metricPm25")}{" "}
                &gt; {rule.threshold}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-pressed={rule.enabled}
                  onClick={() => {
                    onToggleRule(rule.id);
                  }}
                  className="min-h-[44px] rounded-md border border-borderc-strong px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-muted"
                >
                  {rule.enabled ? t("toggleOn") : t("toggleOff")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRemoveRule(rule.id);
                  }}
                  className="min-h-[44px] rounded-md border border-rose-700 px-3 py-1.5 text-xs font-semibold text-rose-900 hover:bg-rose-50 dark:border-rose-400 dark:text-rose-100 dark:hover:bg-rose-950/60"
                >
                  {t("deleteRule")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

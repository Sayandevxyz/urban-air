"use client";

import { useTranslations } from "next-intl";
import { AlertRuleForm } from "@/components/AlertRuleForm";
import { getDemoCityLocations } from "@/services/demo-data";
import type { CityLocation } from "@/types/air-quality";
import type { ThresholdAlertRule, TriggeredAlert } from "@/types/guidance";

function AlertRuleList({
  rules,
  onToggleRule,
  onRemoveRule,
}: {
  readonly rules: readonly ThresholdAlertRule[];
  readonly onToggleRule: (ruleId: string) => void;
  readonly onRemoveRule: (ruleId: string) => void;
}) {
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

/**
 * Configures local browser AQI/PM2.5 threshold rules and surfaces live alerts when breached.
 */
export function ThresholdAlertsSection({
  currentCity,
  rules,
  triggeredAlerts,
  onAddRule,
  onToggleRule,
  onRemoveRule,
}: {
  readonly currentCity: CityLocation | null;
  readonly rules: readonly ThresholdAlertRule[];
  readonly triggeredAlerts: readonly TriggeredAlert[];
  readonly onAddRule: (input: {
    cityKey: string;
    cityName: string;
    metric: "usAqi" | "pm25";
    threshold: number;
  }) => void;
  readonly onToggleRule: (ruleId: string) => void;
  readonly onRemoveRule: (ruleId: string) => void;
}) {
  const t = useTranslations("alerts");
  const presets = getDemoCityLocations();
  const cityOptions =
    currentCity && !presets.some((c) => c.key === currentCity.key)
      ? [currentCity, ...presets]
      : presets;

  return (
    <section
      id="alerts"
      className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6"
    >
      <h2 id="alerts-heading" className="text-xl font-bold text-ink">
        {t("sectionTitle")}
      </h2>

      {triggeredAlerts.length > 0 && (
        <div
          role="alert"
          className="mt-4 rounded-lg border-2 border-amber-700 bg-amber-50 p-4 text-amber-950 dark:border-amber-400 dark:bg-amber-950/60 dark:text-amber-100"
        >
          <h3 className="text-base font-bold">{t("activeAlertsTitle")}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold">
            {triggeredAlerts.map((alert) => (
              <li key={alert.ruleId}>
                {t("ruleTriggered", {
                  city: alert.cityName,
                  metric: alert.metric === "usAqi" ? t("metricUsAqi") : t("metricPm25"),
                  actual: alert.actualValue,
                  threshold: alert.threshold,
                })}
              </li>
            ))}
          </ul>
        </div>
      )}

      <AlertRuleForm
        cityOptions={cityOptions}
        defaultCityKey={currentCity?.key ?? "delhi"}
        onAddRule={onAddRule}
      />
      <AlertRuleList rules={rules} onToggleRule={onToggleRule} onRemoveRule={onRemoveRule} />
    </section>
  );
}

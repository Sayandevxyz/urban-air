"use client";

import { useTranslations } from "next-intl";
import { useState, type SyntheticEvent } from "react";
import type { CityLocation, ThresholdAlertRule, TriggeredAlert } from "@/domain/types";
import { getDemoCityLocations } from "@/services/demo-data";

interface ThresholdAlertsSectionProps {
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
}: ThresholdAlertsSectionProps) {
  const t = useTranslations("alerts");
  const presets = getDemoCityLocations();
  const cityOptions =
    currentCity && !presets.some((c) => c.key === currentCity.key)
      ? [currentCity, ...presets]
      : presets;

  const [cityKey, setCityKey] = useState(currentCity?.key ?? "delhi");
  const [metric, setMetric] = useState<"usAqi" | "pm25">("usAqi");
  const [thresholdRaw, setThresholdRaw] = useState("100");
  const [validationError, setValidationError] = useState(false);

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    const numeric = Number(thresholdRaw);
    if (!Number.isFinite(numeric) || numeric < 10 || numeric > 500) {
      setValidationError(true);
      return;
    }
    setValidationError(false);
    const chosen = cityOptions.find((c) => c.key === cityKey) ?? cityOptions[0];
    if (chosen) {
      onAddRule({
        cityKey: chosen.key,
        cityName: chosen.name,
        metric,
        threshold: Math.round(numeric),
      });
    }
  };

  return (
    <section
      id="alerts"
      aria-labelledby="alerts-heading"
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

      <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-4 sm:items-end">
        <div>
          <label htmlFor="alert-city-select" className="block text-sm font-semibold text-ink">
            {t("cityLabel")}
          </label>
          <select
            id="alert-city-select"
            value={cityKey}
            onChange={(event) => {
              setCityKey(event.target.value);
            }}
            className="mt-1 min-h-[48px] w-full rounded-lg border-2 border-borderc-strong bg-surface px-3 py-2 text-base text-ink"
          >
            {cityOptions.map((city) => (
              <option key={city.key} value={city.key}>
                {city.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="alert-metric-select" className="block text-sm font-semibold text-ink">
            {t("metricLabel")}
          </label>
          <select
            id="alert-metric-select"
            value={metric}
            onChange={(event) => {
              setMetric(event.target.value === "pm25" ? "pm25" : "usAqi");
            }}
            className="mt-1 min-h-[48px] w-full rounded-lg border-2 border-borderc-strong bg-surface px-3 py-2 text-base text-ink"
          >
            <option value="usAqi">{t("metricUsAqi")}</option>
            <option value="pm25">{t("metricPm25")}</option>
          </select>
        </div>

        <div>
          <label htmlFor="alert-threshold-input" className="block text-sm font-semibold text-ink">
            {t("thresholdLabel")}
          </label>
          <input
            id="alert-threshold-input"
            type="number"
            min={10}
            max={500}
            value={thresholdRaw}
            aria-invalid={validationError}
            aria-describedby={validationError ? "alert-threshold-error" : undefined}
            onChange={(event) => {
              setThresholdRaw(event.target.value);
              setValidationError(false);
            }}
            className="mt-1 min-h-[48px] w-full rounded-lg border-2 border-borderc-strong bg-surface px-3 py-2 text-base text-ink"
          />
          {validationError && (
            <p
              id="alert-threshold-error"
              className="mt-1 text-xs font-semibold text-rose-800 dark:text-rose-200"
            >
              {t("thresholdError")}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="min-h-[48px] rounded-lg border-2 border-accent bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong"
        >
          {t("addAlertButton")}
        </button>
      </form>

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
    </section>
  );
}

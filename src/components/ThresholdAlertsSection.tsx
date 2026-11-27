// ============================================================================
// src/components/ThresholdAlertsSection.tsx
// Renders active threshold warnings, rule creation form, and saved alert list.
// ============================================================================

"use client";

import { useTranslations } from "next-intl";
import {
  NumericField,
  SectionCard,
  SelectField,
  TONE_SURFACE_CLASSES,
} from "@/components/UiPrimitives";
import { useAlertForm } from "@/hooks/useLocalAlerts";
import { ALERT_THRESHOLD_MAX, ALERT_THRESHOLD_MIN } from "@/lib/constants";
import { getDemoCityLocations } from "@/services/demo-data";
import type { CityLocation } from "@/types/air-quality";
import type { ThresholdAlertRule, TriggeredAlert } from "@/types/guidance";

type AddRuleHandler = (input: {
  cityKey: string;
  cityName: string;
  metric: "usAqi" | "pm25";
  threshold: number;
}) => void;

interface AlertFormProps {
  readonly cityOptions: readonly CityLocation[];
  readonly defaultCityKey: string;
  readonly onAddRule: AddRuleHandler;
}

interface AlertsSectionProps {
  readonly currentCity: CityLocation | null;
  readonly rules: readonly ThresholdAlertRule[];
  readonly triggeredAlerts: readonly TriggeredAlert[];
  readonly onAddRule: AddRuleHandler;
  readonly onToggleRule: (ruleId: string) => void;
  readonly onRemoveRule: (ruleId: string) => void;
}

const BTN = {
  submit:
    "min-h-[48px] rounded-lg border-2 border-accent bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong",
  toggle:
    "min-h-[44px] rounded-md border border-borderc-strong px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-muted",
  remove:
    "min-h-[44px] rounded-md border border-rose-700 px-3 py-1.5 text-xs font-semibold text-rose-900 hover:bg-rose-50 dark:border-rose-400 dark:text-rose-100 dark:hover:bg-rose-950/60",
};

function TriggeredAlertsBanner({ alerts }: { readonly alerts: readonly TriggeredAlert[] }) {
  const t = useTranslations("alerts");
  if (alerts.length === 0) return null;
  return (
    <div role="alert" className={`mt-4 rounded-lg p-4 ${TONE_SURFACE_CLASSES.amber}`}>
      <h3 className="text-base font-bold">{t("activeAlertsTitle")}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold">
        {alerts.map((a) => (
          <li key={a.ruleId}>
            {t("ruleTriggered", {
              city: a.cityName,
              metric: t(a.metric === "usAqi" ? "metricUsAqi" : "metricPm25"),
              actual: a.actualValue,
              threshold: a.threshold,
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AlertRuleForm({ cityOptions, defaultCityKey, onAddRule }: AlertFormProps) {
  const t = useTranslations("alerts");
  const s = useAlertForm(cityOptions, defaultCityKey, onAddRule);
  const cityOpts = cityOptions.map((c) => ({ value: c.key, label: c.name }));
  const metricOpts = [
    { value: "usAqi", label: t("metricUsAqi") },
    { value: "pm25", label: t("metricPm25") },
  ];
  return (
    <form
      onSubmit={s.handleSubmit}
      noValidate
      className="mt-4 grid gap-4 sm:grid-cols-4 sm:items-end"
    >
      <SelectField
        id="alert-city-select"
        label={t("cityLabel")}
        value={s.cityKey}
        onChange={s.setCityKey}
        options={cityOpts}
      />
      <SelectField
        id="alert-metric-select"
        label={t("metricLabel")}
        value={s.metric}
        onChange={s.updateMetric}
        options={metricOpts}
      />
      <NumericField
        id="alert-threshold-input"
        label={t("thresholdLabel")}
        min={ALERT_THRESHOLD_MIN}
        max={ALERT_THRESHOLD_MAX}
        value={s.thresholdRaw}
        invalid={s.invalid}
        errorId="alert-threshold-error"
        errorText={t("thresholdError")}
        onChange={s.updateThreshold}
      />
      <button type="submit" className={BTN.submit}>
        {t("addAlertButton")}
      </button>
    </form>
  );
}

function AlertRuleRow({
  rule,
  onToggle,
  onRemove,
}: {
  readonly rule: ThresholdAlertRule;
  readonly onToggle: (ruleId: string) => void;
  readonly onRemove: (ruleId: string) => void;
}) {
  const t = useTranslations("alerts");
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-borderc bg-surface px-4 py-3 text-sm">
      <span className="font-semibold text-ink">
        {rule.cityName} · {t(rule.metric === "usAqi" ? "metricUsAqi" : "metricPm25")} &gt;{" "}
        {rule.threshold}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={rule.enabled}
          onClick={() => {
            onToggle(rule.id);
          }}
          className={BTN.toggle}
        >
          {t(rule.enabled ? "toggleOn" : "toggleOff")}
        </button>
        <button
          type="button"
          onClick={() => {
            onRemove(rule.id);
          }}
          className={BTN.remove}
        >
          {t("deleteRule")}
        </button>
      </div>
    </li>
  );
}

/** Configures local browser AQI/PM2.5 threshold rules and surfaces live alerts when breached. */
export function ThresholdAlertsSection(props: AlertsSectionProps) {
  const t = useTranslations("alerts");
  const presets = getDemoCityLocations();
  const cur = props.currentCity;
  const cityOptions = cur && !presets.some((c) => c.key === cur.key) ? [cur, ...presets] : presets;
  return (
    <SectionCard id="alerts">
      <h2 id="alerts-heading" className="text-xl font-bold text-ink">
        {t("sectionTitle")}
      </h2>
      <TriggeredAlertsBanner alerts={props.triggeredAlerts} />
      <AlertRuleForm
        cityOptions={cityOptions}
        defaultCityKey={cur?.key ?? "delhi"}
        onAddRule={props.onAddRule}
      />
      <div className="mt-5" aria-live="polite">
        {props.rules.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("noRules")}</p>
        ) : (
          <ul className="space-y-2">
            {props.rules.map((r) => (
              <AlertRuleRow
                key={r.id}
                rule={r}
                onToggle={props.onToggleRule}
                onRemove={props.onRemoveRule}
              />
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}

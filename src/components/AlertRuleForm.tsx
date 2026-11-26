import { useTranslations } from "next-intl";
import { useState, type SyntheticEvent } from "react";
import type { CityLocation } from "@/domain/types";
import { ALERT_DEFAULT_THRESHOLD, ALERT_THRESHOLD_MAX, ALERT_THRESHOLD_MIN } from "@/lib/constants";

interface AlertRuleFormProps {
  readonly cityOptions: readonly CityLocation[];
  readonly defaultCityKey: string;
  readonly onAddRule: (input: {
    cityKey: string;
    cityName: string;
    metric: "usAqi" | "pm25";
    threshold: number;
  }) => void;
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="mt-1 min-h-[48px] w-full rounded-lg border-2 border-borderc-strong bg-surface px-3 py-2 text-base text-ink"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ThresholdField({
  label,
  value,
  errorText,
  invalid,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly errorText: string;
  readonly invalid: boolean;
  readonly onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor="alert-threshold-input" className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id="alert-threshold-input"
        type="number"
        min={ALERT_THRESHOLD_MIN}
        max={ALERT_THRESHOLD_MAX}
        value={value}
        aria-invalid={invalid}
        aria-describedby={invalid ? "alert-threshold-error" : undefined}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="mt-1 min-h-[48px] w-full rounded-lg border-2 border-borderc-strong bg-surface px-3 py-2 text-base text-ink"
      />
      {invalid && (
        <p
          id="alert-threshold-error"
          className="mt-1 text-xs font-semibold text-rose-800 dark:text-rose-200"
        >
          {errorText}
        </p>
      )}
    </div>
  );
}

/**
 * Validated threshold alert creation form with accessible inline error announcements.
 */
export function AlertRuleForm({ cityOptions, defaultCityKey, onAddRule }: AlertRuleFormProps) {
  const t = useTranslations("alerts");
  const [cityKey, setCityKey] = useState(defaultCityKey);
  const [metric, setMetric] = useState<"usAqi" | "pm25">("usAqi");
  const [thresholdRaw, setThresholdRaw] = useState(String(ALERT_DEFAULT_THRESHOLD));
  const [validationError, setValidationError] = useState(false);

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    const numeric = Number(thresholdRaw);
    const outOfRange =
      !Number.isFinite(numeric) || numeric < ALERT_THRESHOLD_MIN || numeric > ALERT_THRESHOLD_MAX;
    if (outOfRange) {
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
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-4 grid gap-4 sm:grid-cols-4 sm:items-end"
    >
      <SelectField
        id="alert-city-select"
        label={t("cityLabel")}
        value={cityKey}
        onChange={setCityKey}
        options={cityOptions.map((c) => ({ value: c.key, label: c.name }))}
      />
      <SelectField
        id="alert-metric-select"
        label={t("metricLabel")}
        value={metric}
        onChange={(val) => {
          setMetric(val === "pm25" ? "pm25" : "usAqi");
        }}
        options={[
          { value: "usAqi", label: t("metricUsAqi") },
          { value: "pm25", label: t("metricPm25") },
        ]}
      />
      <ThresholdField
        label={t("thresholdLabel")}
        value={thresholdRaw}
        errorText={t("thresholdError")}
        invalid={validationError}
        onChange={(val) => {
          setThresholdRaw(val);
          setValidationError(false);
        }}
      />
      <button
        type="submit"
        className="min-h-[48px] rounded-lg border-2 border-accent bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong"
      >
        {t("addAlertButton")}
      </button>
    </form>
  );
}

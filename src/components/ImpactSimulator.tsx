// ============================================================================
// src/components/ImpactSimulator.tsx
// Renders direct impact controls (distance, hours, toggles) and metric cards.
// ============================================================================

import { useTranslations } from "next-intl";
import { COMMUTE_MAX_KM, OUTDOOR_MAX_HOURS } from "@/lib/constants";
import type { DirectImpactResult } from "@/types/guidance";

const OUTDOOR_HOURS_STEP = 0.5;

interface RoutineToggleItem {
  readonly key: string;
  readonly checked: boolean;
  readonly setter: (next: boolean) => void;
}

interface ImpactSimulatorProps {
  readonly commuteDistanceKm: number;
  readonly outdoorHours: number;
  readonly onChangeDistance: (val: number) => void;
  readonly onChangeOutdoorHours: (val: number) => void;
  readonly toggles: readonly RoutineToggleItem[];
  readonly impact: DirectImpactResult;
}

function CommuteNumericInput({
  id,
  label,
  max,
  step,
  value,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly onChange: (val: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
        className="mt-1 min-h-[48px] w-full rounded-lg border-2 border-borderc-strong bg-surface-elevated px-3 py-2 text-base text-ink"
      />
    </div>
  );
}

function ImpactToggleList({ toggles }: { readonly toggles: readonly RoutineToggleItem[] }) {
  const t = useTranslations("routines");
  return (
    <div className="mt-4 space-y-2">
      {toggles.map(({ key, checked, setter }) => (
        <div key={key} className="flex min-h-[44px] items-center gap-3">
          <input
            id={`toggle-${key}`}
            type="checkbox"
            checked={checked}
            onChange={(event) => {
              setter(event.target.checked);
            }}
            className="h-5 w-5 shrink-0 accent-accent"
          />
          <label htmlFor={`toggle-${key}`} className="text-sm font-medium text-ink">
            {t(`toggles.${key}`)}
          </label>
        </div>
      ))}
    </div>
  );
}

function ImpactKpiCards({ impact }: { readonly impact: DirectImpactResult }) {
  const t = useTranslations("routines");
  return (
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
  );
}

function ImpactSummaryMetrics({ impact }: { readonly impact: DirectImpactResult }) {
  const t = useTranslations("routines");
  return (
    <>
      <ImpactKpiCards impact={impact} />
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

/** Renders routine impact controls (distance, hours, toggles) alongside live outcomes. */
export function ImpactSimulator({
  commuteDistanceKm,
  outdoorHours,
  onChangeDistance,
  onChangeOutdoorHours,
  toggles,
  impact,
}: ImpactSimulatorProps) {
  const t = useTranslations("routines");
  return (
    <>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <CommuteNumericInput
          id="impact-distance-input"
          label={t("distanceLabel")}
          max={COMMUTE_MAX_KM}
          step={1}
          value={commuteDistanceKm}
          onChange={onChangeDistance}
        />
        <CommuteNumericInput
          id="impact-hours-input"
          label={t("outdoorHoursLabel")}
          max={OUTDOOR_MAX_HOURS}
          step={OUTDOOR_HOURS_STEP}
          value={outdoorHours}
          onChange={onChangeOutdoorHours}
        />
      </div>
      <ImpactToggleList toggles={toggles} />
      <ImpactSummaryMetrics impact={impact} />
    </>
  );
}

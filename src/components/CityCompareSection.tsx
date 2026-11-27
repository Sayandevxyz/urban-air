// ============================================================================
// src/components/CityCompareSection.tsx
// Renders side-by-side comparison across up to three selected urban cities.
// ============================================================================

"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { summarizeCityComparison } from "@/domain/planner";
import { MAX_COMPARE_CITIES } from "@/lib/constants";
import { getDemoCityLocations } from "@/services/demo-data";
import type { AirQualityReport, CityLocation } from "@/types/air-quality";

const HEADERS = [
  "cityCol",
  "usAqiCol",
  "euAqiCol",
  "dominantCol",
  "smogCol",
  "bestHourCol",
] as const;

interface CompareSectionProps {
  readonly cities: readonly CityLocation[];
  readonly reports: Readonly<Record<string, AirQualityReport>>;
  readonly loading: boolean;
  readonly onAddCity: (city: CityLocation) => void;
  readonly onRemoveCity: (cityKey: string) => void;
}

function CompareCityRow({
  city,
  report,
  onRemoveCity,
}: {
  readonly city: CityLocation;
  readonly report: AirQualityReport;
  readonly onRemoveCity: (cityKey: string) => void;
}) {
  const t = useTranslations("compare");
  const tDash = useTranslations("dashboard");
  const tPol = useTranslations("pollutants");
  const s = summarizeCityComparison(report);
  return (
    <tr className="border-t border-borderc">
      <th scope="row" className="p-3 font-bold text-ink">
        {city.name}
      </th>
      <td className="p-3 font-semibold tabular-nums">
        {report.current.usAqi} ({tDash(`categories.${s.usCategory}`)})
      </td>
      <td className="p-3 tabular-nums">{report.current.europeanAqi}</td>
      <td className="p-3">{tPol(`items.${s.dominant}.name`)}</td>
      <td className="p-3 font-semibold">{t(`smogSeverity.${s.smogSeverity}`)}</td>
      <td className="p-3 tabular-nums">{s.bestLabel}</td>
      <td className="p-3">
        <button
          type="button"
          onClick={() => {
            onRemoveCity(city.key);
          }}
          className="min-h-[44px] rounded-md border border-borderc-strong px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-muted"
        >
          {t("removeCity", { city: city.name })}
        </button>
      </td>
    </tr>
  );
}

function CompareTableRows({
  cities,
  reports,
  onRemoveCity,
}: Pick<CompareSectionProps, "cities" | "reports" | "onRemoveCity">) {
  return (
    <tbody>
      {cities.map((c) => {
        const report = reports[c.key];
        return report ? (
          <CompareCityRow key={c.key} city={c} report={report} onRemoveCity={onRemoveCity} />
        ) : null;
      })}
    </tbody>
  );
}

function CompareTable(props: Omit<CompareSectionProps, "onAddCity">) {
  const t = useTranslations("compare");
  return (
    <div
      tabIndex={0}
      role="region"
      aria-labelledby="compare-table-caption"
      aria-busy={props.loading}
      className="relative mt-4 overflow-x-auto rounded-lg border border-borderc"
    >
      <table className="w-full border-collapse text-left text-sm">
        <caption id="compare-table-caption" className="p-2.5 text-left font-semibold text-ink">
          {t("sectionTitle")}
        </caption>
        <thead className="bg-surface-muted text-ink">
          <tr>
            {HEADERS.map((k) => (
              <th key={k} scope="col" className="p-3 font-bold">
                {t(k)}
              </th>
            ))}
            <th scope="col" className="relative p-3 font-bold">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <CompareTableRows
          cities={props.cities}
          reports={props.reports}
          onRemoveCity={props.onRemoveCity}
        />
      </table>
    </div>
  );
}

function CompareAddControls({
  limitReached,
  onAddCity,
}: {
  readonly limitReached: boolean;
  readonly onAddCity: (city: CityLocation) => void;
}) {
  const t = useTranslations("compare");
  const presets = getDemoCityLocations();
  const [candidateKey, setCandidateKey] = useState(presets[2]?.key ?? "mumbai");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="compare-city-select" className="block text-sm font-semibold text-ink">
          {t("addCityLabel")}
        </label>
        <select
          id="compare-city-select"
          value={candidateKey}
          onChange={(e) => {
            setCandidateKey(e.target.value);
          }}
          className="mt-1 min-h-[44px] max-w-full rounded-lg border-2 border-borderc-strong bg-surface px-3 py-2 text-base text-ink"
        >
          {presets.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}, {c.country}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={limitReached}
        onClick={() => {
          const match = presets.find((c) => c.key === candidateKey);
          if (match) onAddCity(match);
        }}
        className="min-h-[44px] rounded-lg border-2 border-accent bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
      >
        {t("addCityButton")}
      </button>
    </div>
  );
}

/** Side-by-side comparison section managing city selection up to MAX_COMPARE_CITIES. */
export function CityCompareSection(props: CompareSectionProps) {
  const t = useTranslations("compare");
  const limitReached = props.cities.length >= MAX_COMPARE_CITIES;
  return (
    <section
      id="compare"
      className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="compare-heading" className="text-xl font-bold text-ink">
          {t("sectionTitle")}
        </h2>
        <CompareAddControls limitReached={limitReached} onAddCity={props.onAddCity} />
      </div>
      {limitReached && <p className="mt-2 text-sm text-ink-muted">{t("maxReached")}</p>}
      {props.cities.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">{t("emptyCompare")}</p>
      ) : (
        <CompareTable
          cities={props.cities}
          reports={props.reports}
          loading={props.loading}
          onRemoveCity={props.onRemoveCity}
        />
      )}
    </section>
  );
}

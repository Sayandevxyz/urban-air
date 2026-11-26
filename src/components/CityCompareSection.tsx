"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { CompareTable } from "@/components/CompareTable";
import type { AirQualityReport, CityLocation } from "@/domain/types";
import { MAX_COMPARE_CITIES } from "@/lib/constants";
import { getDemoCityLocations } from "@/services/demo-data";

interface CityCompareSectionProps {
  readonly cities: readonly CityLocation[];
  readonly reports: Readonly<Record<string, AirQualityReport>>;
  readonly loading: boolean;
  readonly onAddCity: (city: CityLocation) => void;
  readonly onRemoveCity: (cityKey: string) => void;
}

/**
 * Side-by-side comparison section managing city selection up to MAX_COMPARE_CITIES.
 */
export function CityCompareSection({
  cities,
  reports,
  loading,
  onAddCity,
  onRemoveCity,
}: CityCompareSectionProps) {
  const t = useTranslations("compare");
  const availablePresets = getDemoCityLocations();
  const [candidateKey, setCandidateKey] = useState(availablePresets[2]?.key ?? "mumbai");

  const handleAdd = () => {
    const match = availablePresets.find((city) => city.key === candidateKey);
    if (match) onAddCity(match);
  };

  return (
    <section
      id="compare"
      className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="compare-heading" className="text-xl font-bold text-ink">
          {t("sectionTitle")}
        </h2>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="compare-city-select" className="block text-sm font-semibold text-ink">
              {t("addCityLabel")}
            </label>
            <select
              id="compare-city-select"
              value={candidateKey}
              onChange={(event) => {
                setCandidateKey(event.target.value);
              }}
              className="mt-1 min-h-[44px] max-w-full rounded-lg border-2 border-borderc-strong bg-surface px-3 py-2 text-base text-ink"
            >
              {availablePresets.map((city) => (
                <option key={city.key} value={city.key}>
                  {city.name}, {city.country}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={cities.length >= MAX_COMPARE_CITIES}
            onClick={handleAdd}
            className="min-h-[44px] rounded-lg border-2 border-accent bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
          >
            {t("addCityButton")}
          </button>
        </div>
      </div>

      {cities.length >= MAX_COMPARE_CITIES && (
        <p className="mt-2 text-sm text-ink-muted">{t("maxReached")}</p>
      )}
      {cities.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">{t("emptyCompare")}</p>
      ) : (
        <CompareTable
          cities={cities}
          reports={reports}
          loading={loading}
          onRemoveCity={onRemoveCity}
        />
      )}
    </section>
  );
}

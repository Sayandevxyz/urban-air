"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  assessPollutants,
  assessWinterSmog,
  classifyUsAqi,
  findDominantPollutant,
} from "@/domain/aqi";
import { scoreActivityWindows } from "@/domain/planner";
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
 * Side-by-side comparison table and summary cards for up to 3 cities.
 */
export function CityCompareSection({
  cities,
  reports,
  loading,
  onAddCity,
  onRemoveCity,
}: CityCompareSectionProps) {
  const t = useTranslations("compare");
  const tDash = useTranslations("dashboard");
  const tPol = useTranslations("pollutants");
  const availablePresets = getDemoCityLocations();
  const [candidateKey, setCandidateKey] = useState(availablePresets[2]?.key ?? "mumbai");

  const handleAdd = () => {
    const match = availablePresets.find((city) => city.key === candidateKey);
    if (match) {
      onAddCity(match);
    }
  };

  return (
    <section
      id="compare"
      aria-labelledby="compare-heading"
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
              className="mt-1 min-h-[44px] rounded-lg border-2 border-borderc-strong bg-surface px-3 py-2 text-base text-ink"
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
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="compare-heading"
          aria-busy={loading}
          className="mt-4 overflow-x-auto rounded-lg border border-borderc"
        >
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-surface-muted text-ink">
              <tr>
                <th scope="col" className="p-3 font-bold">
                  {t("cityCol")}
                </th>
                <th scope="col" className="p-3 font-bold">
                  {t("usAqiCol")}
                </th>
                <th scope="col" className="p-3 font-bold">
                  {t("euAqiCol")}
                </th>
                <th scope="col" className="p-3 font-bold">
                  {t("dominantCol")}
                </th>
                <th scope="col" className="p-3 font-bold">
                  {t("smogCol")}
                </th>
                <th scope="col" className="p-3 font-bold">
                  {t("bestHourCol")}
                </th>
                <th scope="col" className="p-3 font-bold">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cities.map((city) => {
                const rep = reports[city.key];
                if (!rep) {
                  return null;
                }
                const usMeta = classifyUsAqi(rep.current.usAqi);
                const dominant = findDominantPollutant(assessPollutants(rep.current.readings));
                const smog = assessWinterSmog(rep.current.usAqi, rep.current.readings);
                const best = scoreActivityWindows(rep.hourly, "walk", "general").bestWindow;
                return (
                  <tr key={city.key} className="border-t border-borderc">
                    <th scope="row" className="p-3 font-bold text-ink">
                      {city.name}
                    </th>
                    <td className="p-3 font-semibold tabular-nums">
                      {rep.current.usAqi} ({tDash(`categories.${usMeta.category}`)})
                    </td>
                    <td className="p-3 tabular-nums">{rep.current.europeanAqi}</td>
                    <td className="p-3">{tPol(`items.${dominant}.name`)}</td>
                    <td className="p-3 font-semibold">{t(`smogSeverity.${smog.severity}`)}</td>
                    <td className="p-3 tabular-nums">
                      {best ? `${best.timeIso.slice(11, 16)} UTC` : "—"}
                    </td>
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
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

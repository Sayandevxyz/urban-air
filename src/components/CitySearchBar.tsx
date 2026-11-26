"use client";

import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";
import { LocationPinIcon } from "@/components/icons/AqiIcons";
import { SearchComboboxField } from "@/components/SearchComboboxField";
import type { CityLocation } from "@/domain/types";
import { useCitySearch, type SearchStatus } from "@/hooks/useCitySearch";
import type { GeoStatusKey } from "@/hooks/useGeolocation";
import { getDemoCityLocations } from "@/services/demo-data";

interface CitySearchBarProps {
  readonly demoMode: boolean;
  readonly selectedCityKey: string | undefined;
  readonly geoStatusMessageKey: GeoStatusKey;
  readonly onSelectCity: (city: CityLocation) => void;
  readonly onUseMyLocation: () => void;
}

function SearchLiveStatus({
  geoStatusMessageKey,
  status,
  retryAfterSeconds,
}: {
  readonly geoStatusMessageKey: GeoStatusKey;
  readonly status: SearchStatus;
  readonly retryAfterSeconds: number;
}) {
  const t = useTranslations("search");
  const tStatus = useTranslations("status");
  const showGeoError =
    geoStatusMessageKey === "locationDenied" || geoStatusMessageKey === "locationUnavailable";
  return (
    <div aria-live="polite" className="mt-2 min-h-[1.25rem]">
      {showGeoError && (
        <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
          {t(geoStatusMessageKey)}
        </p>
      )}
      {status === "rate_limited" && (
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          {tStatus("rateLimitedBody", { seconds: retryAfterSeconds })}
        </p>
      )}
      {status === "error" && (
        <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
          {tStatus("errorTitle")}
        </p>
      )}
    </div>
  );
}

function QuickCityPresets({
  selectedCityKey,
  onChoose,
}: {
  readonly selectedCityKey: string | undefined;
  readonly onChoose: (city: CityLocation) => void;
}) {
  const t = useTranslations("search");
  return (
    <div className="mt-3">
      <p className="text-sm font-semibold text-ink-muted">{t("quickCitiesLabel")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {getDemoCityLocations().map((city) => {
          const active = selectedCityKey === city.key;
          return (
            <button
              key={city.key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                onChoose(city);
              }}
              className={`min-h-[44px] rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-borderc bg-surface text-ink hover:bg-surface-muted"
              }`}
            >
              {city.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function computeNextActiveIndex(key: string, prev: number, total: number): number {
  if (total === 0) return -1;
  return key === "ArrowDown" ? (prev + 1) % total : (prev - 1 + total) % total;
}

/**
 * Accessible ARIA APG combobox city search with 300 ms debounce, geolocation fallback, and presets.
 */
export function CitySearchBar({
  demoMode,
  selectedCityKey,
  geoStatusMessageKey,
  onSelectCity,
  onUseMyLocation,
}: CitySearchBarProps) {
  const t = useTranslations("search");
  const { query, setQuery, results, status, retryAfterSeconds, clearResults } =
    useCitySearch(demoMode);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [open, setOpen] = useState(false);

  const isExpanded = open && (results.length > 0 || status === "loading" || status === "empty");
  const activeOption = activeIndex >= 0 ? results[activeIndex] : undefined;

  const chooseCity = (city: CityLocation) => {
    setQuery(`${city.name}${city.country ? `, ${city.country}` : ""}`);
    setOpen(false);
    setActiveIndex(-1);
    clearResults();
    onSelectCity(city);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (event.key === "ArrowDown") setOpen(true);
      setActiveIndex((prev) => computeNextActiveIndex(event.key, prev, results.length));
    } else if (event.key === "Enter" && open && activeOption) {
      event.preventDefault();
      chooseCity(activeOption);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <section className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-5">
      <h2 id="city-search-heading" className="text-lg font-bold text-ink">
        {t("heading")}
      </h2>
      <div role="search" className="mt-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <SearchComboboxField
            query={query}
            isExpanded={isExpanded}
            activeOption={activeOption}
            results={results}
            status={status}
            activeIndex={activeIndex}
            onQueryChange={(val) => {
              setQuery(val);
              setOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => {
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            onChoose={chooseCity}
          />
          <button
            type="button"
            onClick={onUseMyLocation}
            disabled={geoStatusMessageKey === "locating"}
            className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-lg border-2 border-accent bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-60"
          >
            <LocationPinIcon className="h-5 w-5" />
            <span>{geoStatusMessageKey === "locating" ? t("locating") : t("useLocation")}</span>
          </button>
        </div>
      </div>
      <SearchLiveStatus
        geoStatusMessageKey={geoStatusMessageKey}
        status={status}
        retryAfterSeconds={retryAfterSeconds}
      />
      <QuickCityPresets selectedCityKey={selectedCityKey} onChoose={chooseCity} />
    </section>
  );
}

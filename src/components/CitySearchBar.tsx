"use client";

import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";
import { LocationPinIcon, SearchIcon } from "@/components/icons/AqiIcons";
import type { CityLocation } from "@/domain/types";
import { useCitySearch } from "@/hooks/useCitySearch";
import { getDemoCityLocations } from "@/services/demo-data";

interface CitySearchBarProps {
  readonly demoMode: boolean;
  readonly selectedCityKey: string | undefined;
  readonly geoStatusMessageKey: "none" | "locating" | "locationDenied" | "locationUnavailable";
  readonly onSelectCity: (city: CityLocation) => void;
  readonly onUseMyLocation: () => void;
}

/**
 * Accessible ARIA APG combobox city search with 300 ms debounce, geolocation fallback, and featured presets.
 */
export function CitySearchBar({
  demoMode,
  selectedCityKey,
  geoStatusMessageKey,
  onSelectCity,
  onUseMyLocation,
}: CitySearchBarProps) {
  const t = useTranslations("search");
  const tStatus = useTranslations("status");
  const { query, setQuery, results, status, retryAfterSeconds, clearResults } =
    useCitySearch(demoMode);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [open, setOpen] = useState(false);
  const featuredCities = getDemoCityLocations();

  const isExpanded = open && (results.length > 0 || status === "loading" || status === "empty");
  const activeOptionId =
    activeIndex >= 0 && results[activeIndex]
      ? `city-option-${results[activeIndex].key}`
      : undefined;

  const chooseCity = (city: CityLocation) => {
    setQuery(`${city.name}${city.country ? `, ${city.country}` : ""}`);
    setOpen(false);
    setActiveIndex(-1);
    clearResults();
    onSelectCity(city);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => (results.length === 0 ? -1 : (prev + 1) % results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) =>
        results.length === 0 ? -1 : (prev - 1 + results.length) % results.length,
      );
    } else if (event.key === "Enter" && open && activeIndex >= 0) {
      const selected = results[activeIndex];
      if (selected) {
        event.preventDefault();
        chooseCity(selected);
      }
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
          <div className="relative flex-1">
            <label htmlFor="city-search-input" className="block text-sm font-semibold text-ink">
              {t("inputLabel")}
            </label>
            <p id="city-search-hint" className="mt-0.5 text-sm text-ink-muted">
              {t("inputHint")}
            </p>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-muted">
                <SearchIcon className="h-5 w-5" />
              </span>
              <input
                id="city-search-input"
                name="cityQuery"
                type="search"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isExpanded}
                aria-controls="city-search-listbox"
                aria-activedescendant={activeOptionId}
                aria-describedby="city-search-hint"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={t("inputPlaceholder")}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setOpen(true);
                  setActiveIndex(-1);
                }}
                onFocus={() => {
                  setOpen(true);
                }}
                onKeyDown={handleKeyDown}
                className="min-h-[48px] w-full rounded-lg border-2 border-borderc-strong bg-surface py-2 pl-10 pr-4 text-base text-ink placeholder:text-ink-muted"
              />
            </div>

            {isExpanded && (
              <ul
                id="city-search-listbox"
                role="listbox"
                aria-label={t("listboxLabel")}
                className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border-2 border-borderc-strong bg-surface-elevated p-1 shadow-lg"
              >
                {status === "loading" && (
                  <li className="px-3 py-3 text-sm text-ink-muted">{t("searching")}</li>
                )}
                {status === "empty" && (
                  <li className="px-3 py-3 text-sm text-ink-muted">{t("noResults")}</li>
                )}
                {results.map((city, index) => {
                  const isSelected = index === activeIndex;
                  return (
                    <li
                      key={city.key}
                      id={`city-option-${city.key}`}
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        chooseCity(city);
                      }}
                      className={`flex min-h-[44px] cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm ${
                        isSelected
                          ? "bg-accent font-semibold text-accent-ink"
                          : "text-ink hover:bg-surface-muted"
                      }`}
                    >
                      <span>
                        {city.name}
                        {city.region ? `, ${city.region}` : ""}
                        {city.country ? ` (${city.country})` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

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

      <div aria-live="polite" className="mt-2 min-h-[1.25rem]">
        {geoStatusMessageKey === "locationDenied" && (
          <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
            {t("locationDenied")}
          </p>
        )}
        {geoStatusMessageKey === "locationUnavailable" && (
          <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
            {t("locationUnavailable")}
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

      <div className="mt-3">
        <p className="text-sm font-semibold text-ink-muted">{t("quickCitiesLabel")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {featuredCities.map((city) => {
            const active = selectedCityKey === city.key;
            return (
              <button
                key={city.key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  chooseCity(city);
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
    </section>
  );
}

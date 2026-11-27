// ============================================================================
// src/components/CitySearchBar.tsx
// Orchestrates ARIA APG city search, geolocation trigger, and quick presets.
// ============================================================================

"use client";

import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";
import { LocationPinIcon } from "@/components/AqiVisuals";
import { CitySearchCombobox } from "@/components/CitySearchCombobox";
import type { GeoStatusKey } from "@/hooks/useAirQualityData";
import { useCitySearch } from "@/hooks/useCitySearch";
import { getDemoCityLocations } from "@/services/demo-data";
import type { CityLocation } from "@/types/air-quality";
import type { SearchStatus } from "@/types/api";

interface CitySearchBarProps {
  readonly demoMode: boolean;
  readonly selectedCityKey: string | undefined;
  readonly geoStatusMessageKey: GeoStatusKey;
  readonly onSelectCity: (city: CityLocation) => void;
  readonly onUseMyLocation: () => void;
}

const PRESET_BTN =
  "min-h-[44px] rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors";
const ERR_TXT = "text-sm font-medium text-rose-800 dark:text-rose-200";

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
  const showGeo =
    geoStatusMessageKey === "locationDenied" || geoStatusMessageKey === "locationUnavailable";
  return (
    <div aria-live="polite" className="mt-2 min-h-[1.25rem]">
      {showGeo && <p className={ERR_TXT}>{t(geoStatusMessageKey)}</p>}
      {status === "rate_limited" && (
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          {tStatus("rateLimitedBody", { seconds: retryAfterSeconds })}
        </p>
      )}
      {status === "error" && <p className={ERR_TXT}>{tStatus("errorTitle")}</p>}
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
          const tone = active
            ? "border-accent bg-accent text-accent-ink"
            : "border-borderc bg-surface text-ink hover:bg-surface-muted";
          return (
            <button
              key={city.key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                onChoose(city);
              }}
              className={`${PRESET_BTN} ${tone}`}
            >
              {city.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function computeNextIndex(key: string, prev: number, total: number): number {
  if (total === 0) return -1;
  return key === "ArrowDown" ? (prev + 1) % total : (prev - 1 + total) % total;
}

function resolveKeyIntent(key: string, open: boolean, hasOption: boolean) {
  if (key === "ArrowDown" || key === "ArrowUp") return "arrow";
  if (key === "Enter" && open && hasOption) return "choose";
  return key === "Escape" ? "close" : "noop";
}

function hasDropdownItems(open: boolean, search: ReturnType<typeof useCitySearch>) {
  return (
    open && (search.results.length > 0 || search.status === "loading" || search.status === "empty")
  );
}

function useComboboxState(demoMode: boolean, onSelectCity: (city: CityLocation) => void) {
  const search = useCitySearch(demoMode);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const activeOption = activeIndex >= 0 ? search.results[activeIndex] : undefined;
  const resetMenu = (isOpen = false) => {
    setOpen(isOpen);
    setActiveIndex(-1);
  };
  const chooseCity = (city: CityLocation) => {
    search.setSelectedQueryLabel(`${city.name}${city.country ? `, ${city.country}` : ""}`);
    resetMenu();
    onSelectCity(city);
  };
  const onQueryChange = (val: string) => {
    search.setQuery(val);
    resetMenu(true);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const intent = resolveKeyIntent(e.key, open, Boolean(activeOption));
    if (intent === "noop") return;
    e.preventDefault();
    if (intent === "arrow") {
      if (e.key === "ArrowDown") setOpen(true);
      setActiveIndex((prev) => computeNextIndex(e.key, prev, search.results.length));
    } else if (intent === "choose" && activeOption) chooseCity(activeOption);
    else resetMenu();
  };
  return {
    search,
    setOpen,
    comboProps: {
      query: search.query,
      isExpanded: hasDropdownItems(open, search),
      activeOption,
      results: search.results,
      status: search.status,
      activeIndex,
      onQueryChange,
      onKeyDown,
      onChoose: chooseCity,
    },
  };
}

function LocationButton(props: { readonly geo: GeoStatusKey; readonly onClick: () => void }) {
  const t = useTranslations("search");
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.geo === "locating"}
      className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-lg border-2 border-accent bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-60"
    >
      <LocationPinIcon className="h-5 w-5" />
      <span>{t(props.geo === "locating" ? "locating" : "useLocation")}</span>
    </button>
  );
}

/** Accessible ARIA APG combobox city search with 300 ms debounce, geolocation, and presets. */
export function CitySearchBar(props: CitySearchBarProps) {
  const t = useTranslations("search");
  const cb = useComboboxState(props.demoMode, props.onSelectCity);
  return (
    <section className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-5">
      <h2 id="city-search-heading" className="text-lg font-bold text-ink">
        {t("heading")}
      </h2>
      <div role="search" className="mt-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <CitySearchCombobox
            {...cb.comboProps}
            onFocus={() => {
              cb.setOpen(true);
            }}
          />
          <LocationButton geo={props.geoStatusMessageKey} onClick={props.onUseMyLocation} />
        </div>
      </div>
      <SearchLiveStatus
        geoStatusMessageKey={props.geoStatusMessageKey}
        status={cb.search.status}
        retryAfterSeconds={cb.search.retryAfterSeconds}
      />
      <QuickCityPresets selectedCityKey={props.selectedCityKey} onChoose={cb.comboProps.onChoose} />
    </section>
  );
}

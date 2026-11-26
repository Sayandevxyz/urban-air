import { useTranslations } from "next-intl";
import type { CityLocation } from "@/domain/types";
import type { SearchStatus } from "@/hooks/useCitySearch";

interface CitySuggestionsListProps {
  readonly status: SearchStatus;
  readonly results: readonly CityLocation[];
  readonly activeIndex: number;
  readonly onChoose: (city: CityLocation) => void;
}

/**
 * ARIA APG listbox dropdown rendering autocomplete city matches cleanly for pointer and keyboard users.
 */
export function CitySuggestionsList({
  status,
  results,
  activeIndex,
  onChoose,
}: CitySuggestionsListProps) {
  const t = useTranslations("search");

  return (
    <ul
      id="city-search-listbox"
      role="listbox"
      aria-label={t("listboxLabel")}
      className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border-2 border-borderc-strong bg-surface-elevated p-1 shadow-lg"
    >
      {status === "loading" && (
        <li className="px-3 py-3 text-sm text-ink-muted">{t("searching")}</li>
      )}
      {status === "empty" && <li className="px-3 py-3 text-sm text-ink-muted">{t("noResults")}</li>}
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
              onChoose(city);
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
  );
}

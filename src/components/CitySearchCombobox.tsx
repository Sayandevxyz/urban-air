import { useTranslations } from "next-intl";
import type { KeyboardEvent } from "react";
import { SearchIcon } from "@/components/AqiVisuals";
import type { CityLocation } from "@/types/air-quality";
import type { SearchStatus } from "@/types/api";

interface CitySearchComboboxProps {
  readonly query: string;
  readonly isExpanded: boolean;
  readonly activeOption: CityLocation | undefined;
  readonly results: readonly CityLocation[];
  readonly status: SearchStatus;
  readonly activeIndex: number;
  readonly onQueryChange: (val: string) => void;
  readonly onFocus: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly onChoose: (city: CityLocation) => void;
}

function SuggestionsListbox({
  status,
  results,
  activeIndex,
  onChoose,
}: {
  readonly status: SearchStatus;
  readonly results: readonly CityLocation[];
  readonly activeIndex: number;
  readonly onChoose: (city: CityLocation) => void;
}) {
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

/**
 * Renders the ARIA APG combobox input and floating city suggestions listbox.
 */
export function CitySearchCombobox({
  query,
  isExpanded,
  activeOption,
  results,
  status,
  activeIndex,
  onQueryChange,
  onFocus,
  onKeyDown,
  onChoose,
}: CitySearchComboboxProps) {
  const t = useTranslations("search");
  return (
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
          aria-activedescendant={activeOption ? `city-option-${activeOption.key}` : undefined}
          aria-describedby="city-search-hint"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t("inputPlaceholder")}
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
          }}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          className="min-h-[48px] w-full rounded-lg border-2 border-borderc-strong bg-surface py-2 pl-10 pr-4 text-base text-ink placeholder:text-ink-muted"
        />
      </div>
      {isExpanded && (
        <SuggestionsListbox
          status={status}
          results={results}
          activeIndex={activeIndex}
          onChoose={onChoose}
        />
      )}
    </div>
  );
}

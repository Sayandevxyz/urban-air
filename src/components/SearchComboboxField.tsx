"use client";

import { useTranslations } from "next-intl";
import type { KeyboardEvent } from "react";
import { CitySuggestionsList } from "@/components/CitySuggestionsList";
import { SearchIcon } from "@/components/icons/AqiIcons";
import type { CityLocation } from "@/domain/types";
import type { SearchStatus } from "@/hooks/useCitySearch";

interface SearchComboboxFieldProps {
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

/**
 * Renders the ARIA APG combobox input and floating city suggestions listbox.
 */
export function SearchComboboxField({
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
}: SearchComboboxFieldProps) {
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
        <CitySuggestionsList
          status={status}
          results={results}
          activeIndex={activeIndex}
          onChoose={onChoose}
        />
      )}
    </div>
  );
}

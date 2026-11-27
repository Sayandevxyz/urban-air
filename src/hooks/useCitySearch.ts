"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { fetchApiJson } from "@/lib/api-client";
import { MIN_CITY_QUERY_LENGTH, SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import type { CityLocation } from "@/types/air-quality";
import type { SearchStatus } from "@/types/api";

interface GeocodeApiResponse {
  readonly results?: readonly CityLocation[];
}

interface SearchOutcome {
  readonly status: SearchStatus;
  readonly results: readonly CityLocation[];
  readonly retryAfterSeconds?: number;
}

async function fetchSearchOutcome(
  trimmed: string,
  isDemo: boolean,
  signal: AbortSignal,
): Promise<SearchOutcome | null> {
  const params = new URLSearchParams({ q: trimmed, demo: isDemo ? "true" : "false" });
  const res = await fetchApiJson<GeocodeApiResponse>(`/api/geocode?${params.toString()}`, {
    signal,
  });
  if (res.ok) {
    const list = res.data.results ?? [];
    return { status: list.length > 0 ? "success" : "empty", results: list };
  }
  if (res.kind === "rate_limited") {
    return { status: "rate_limited", results: [], retryAfterSeconds: res.retryAfterSeconds };
  }
  return res.kind === "error" ? { status: "error", results: [] } : null;
}

function useSearchOutcomeState() {
  const [results, setResults] = useState<readonly CityLocation[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const { nextSignal, abortPending } = useAsyncResource();

  const clearResults = useCallback(() => {
    abortPending();
    setResults([]);
    setStatus("idle");
  }, [abortPending]);

  const applyOutcome = useCallback((outcome: SearchOutcome | null) => {
    if (!outcome) return;
    setResults(outcome.results);
    setStatus(outcome.status);
    if (outcome.retryAfterSeconds !== undefined) setRetryAfterSeconds(outcome.retryAfterSeconds);
  }, []);

  return { results, status, setStatus, retryAfterSeconds, nextSignal, clearResults, applyOutcome };
}

function useSearchDebounceEffect(
  query: string,
  demoMode: boolean,
  skipNextEffectRef: { current: boolean },
  state: ReturnType<typeof useSearchOutcomeState>,
) {
  const { clearResults, nextSignal, applyOutcome, setStatus } = state;
  useEffect(() => {
    if (skipNextEffectRef.current) {
      skipNextEffectRef.current = false;
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < MIN_CITY_QUERY_LENGTH) {
      clearResults();
      return;
    }
    const timer = setTimeout(() => {
      const signal = nextSignal();
      setStatus("loading");
      void fetchSearchOutcome(trimmed, demoMode, signal).then(applyOutcome);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [applyOutcome, clearResults, demoMode, nextSignal, query, setStatus, skipNextEffectRef]);
}

/**
 * Debounced city autocomplete hook (300 ms) with AbortController cancellation and 429 handling.
 */
export function useCitySearch(demoMode: boolean) {
  const [query, setQuery] = useState("");
  const skipNextEffectRef = useRef(false);
  const state = useSearchOutcomeState();
  const { clearResults, results, status, retryAfterSeconds } = state;

  const setSelectedQueryLabel = useCallback(
    (label: string) => {
      skipNextEffectRef.current = true;
      setQuery(label);
      clearResults();
    },
    [clearResults],
  );

  useSearchDebounceEffect(query, demoMode, skipNextEffectRef, state);

  return {
    query,
    setQuery,
    setSelectedQueryLabel,
    results,
    status,
    retryAfterSeconds,
    clearResults,
  };
}

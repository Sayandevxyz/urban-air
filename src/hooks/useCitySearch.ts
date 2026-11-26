"use client";

import { useCallback, useEffect, useState } from "react";
import type { CityLocation } from "@/domain/types";
import { fetchApiJson } from "@/hooks/apiClient";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { MIN_CITY_QUERY_LENGTH, SEARCH_DEBOUNCE_MS } from "@/lib/constants";

export type SearchStatus = "idle" | "loading" | "success" | "empty" | "error" | "rate_limited";

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

/**
 * Debounced city autocomplete hook (300 ms) with AbortController cancellation and 429 handling.
 */
export function useCitySearch(demoMode: boolean) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly CityLocation[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const { nextSignal, abortPending } = useAsyncResource();

  const clearResults = useCallback(() => {
    abortPending();
    setResults([]);
    setStatus("idle");
  }, [abortPending]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_CITY_QUERY_LENGTH) {
      clearResults();
      return;
    }
    const timer = setTimeout(() => {
      const signal = nextSignal();
      setStatus("loading");
      void fetchSearchOutcome(trimmed, demoMode, signal).then((outcome) => {
        if (!outcome) return;
        setResults(outcome.results);
        setStatus(outcome.status);
        if (outcome.retryAfterSeconds !== undefined) {
          setRetryAfterSeconds(outcome.retryAfterSeconds);
        }
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [clearResults, demoMode, nextSignal, query]);

  return { query, setQuery, results, status, retryAfterSeconds, clearResults };
}

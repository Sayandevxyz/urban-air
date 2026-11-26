"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CityLocation } from "@/domain/types";
import { MIN_CITY_QUERY_LENGTH, SEARCH_DEBOUNCE_MS } from "@/lib/constants";

export type SearchStatus = "idle" | "loading" | "success" | "empty" | "error" | "rate_limited";

interface GeocodeApiResponse {
  results?: CityLocation[];
  error?: { code?: string; retryAfterSeconds?: number };
}

/**
 * Debounced city autocomplete hook (300 ms) with AbortController cancellation for stale queries.
 */
export function useCitySearch(demoMode: boolean) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly CityLocation[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const clearResults = useCallback(() => {
    abortRef.current?.abort();
    setResults([]);
    setStatus("idle");
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_CITY_QUERY_LENGTH) {
      abortRef.current?.abort();
      setResults([]);
      setStatus("idle");
      return;
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading");

      const params = new URLSearchParams({
        q: trimmed,
        demo: demoMode ? "true" : "false",
      });

      void fetch(`/api/geocode?${params.toString()}`, { signal: controller.signal })
        .then(async (res) => {
          const data = (await res.json()) as GeocodeApiResponse;
          if (res.status === 429) {
            setRetryAfterSeconds(data.error?.retryAfterSeconds ?? 30);
            setStatus("rate_limited");
            setResults([]);
            return;
          }
          if (!res.ok) {
            setStatus("error");
            setResults([]);
            return;
          }
          const list = data.results ?? [];
          setResults(list);
          setStatus(list.length > 0 ? "success" : "empty");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setStatus("error");
          setResults([]);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [query, demoMode]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { query, setQuery, results, status, retryAfterSeconds, clearResults };
}

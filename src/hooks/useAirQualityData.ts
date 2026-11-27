// ============================================================================
// src/hooks/useAirQualityData.ts
// Manages active city selection, AQI report fetching, offline cache, and geo.
// ============================================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { fetchAirQuality, readCachedSnapshot } from "@/lib/api-client";
import { COORDINATE_ROUND_FACTOR, GEO_MAX_AGE_MS, GEO_TIMEOUT_MS } from "@/lib/constants";
import { getDemoAirQualityReport, getDemoCityLocations } from "@/services/demo-data";
import type { AirQualityReport, CityLocation } from "@/types/air-quality";
import type { LoadState } from "@/types/api";

/** Status key surfaced alongside city search for geolocation permission feedback. */
export type GeoStatusKey = "none" | "locating" | "locationDenied" | "locationUnavailable";

interface LoadOutcome {
  readonly loadState: LoadState;
  readonly report?: AirQualityReport;
  readonly retryAfterSeconds?: number;
}

function roundCoord(value: number): number {
  return Math.round(value * COORDINATE_ROUND_FACTOR) / COORDINATE_ROUND_FACTOR;
}

function resolveFallbackOutcome(location: CityLocation, requireSameCity: boolean): LoadOutcome {
  const cached = readCachedSnapshot();
  const usable = cached && (!requireSameCity || cached.location.key === location.key);
  return usable ? { loadState: "offline", report: cached } : { loadState: "error" };
}

async function fetchLocationOutcome(
  location: CityLocation,
  useDemo: boolean,
  signal: AbortSignal,
): Promise<LoadOutcome | null> {
  if (!useDemo && typeof navigator !== "undefined" && !navigator.onLine) {
    return resolveFallbackOutcome(location, false);
  }
  const result = await fetchAirQuality(location, useDemo, signal);
  if (result.ok) {
    return { loadState: "ready", report: result.data };
  }
  if (result.kind === "rate_limited") {
    return { loadState: "rate_limited", retryAfterSeconds: result.retryAfterSeconds };
  }
  return result.kind === "error" ? resolveFallbackOutcome(location, result.status > 0) : null;
}

function applyLoadOutcome(
  outcome: LoadOutcome | null,
  setReport: (report: AirQualityReport) => void,
  setRetryAfterSeconds: (sec: number) => void,
  setLoadState: (state: LoadState) => void,
): void {
  if (!outcome) return;
  if (outcome.report) setReport(outcome.report);
  if (outcome.retryAfterSeconds !== undefined) setRetryAfterSeconds(outcome.retryAfterSeconds);
  setLoadState(outcome.loadState);
}

function useGeolocation(onLocated: (city: CityLocation) => void) {
  const [geoStatusMessageKey, setGeoStatusMessageKey] = useState<GeoStatusKey>("none");
  const clearGeoMessage = useCallback(() => {
    setGeoStatusMessageKey("none");
  }, []);

  const requestUserLocation = useCallback(() => {
    const geo: Partial<Geolocation> | undefined =
      typeof navigator !== "undefined" ? navigator.geolocation : undefined;
    if (typeof geo?.getCurrentPosition !== "function") {
      setGeoStatusMessageKey("locationUnavailable");
      return;
    }
    setGeoStatusMessageKey("locating");
    geo.getCurrentPosition(
      (position) => {
        setGeoStatusMessageKey("none");
        onLocated({
          key: "geo-self-current",
          name: "Current Location",
          region: "",
          country: "",
          latitude: roundCoord(position.coords.latitude),
          longitude: roundCoord(position.coords.longitude),
          timezone: "auto",
        });
      },
      (geoError) => {
        setGeoStatusMessageKey(
          geoError.code === geoError.PERMISSION_DENIED ? "locationDenied" : "locationUnavailable",
        );
      },
      { enableHighAccuracy: false, timeout: GEO_TIMEOUT_MS, maximumAge: GEO_MAX_AGE_MS },
    );
  }, [onLocated]);

  return { geoStatusMessageKey, requestUserLocation, clearGeoMessage };
}

function useAirQualityLoader(initialDemoMode: boolean) {
  const [selectedCity, setSelectedCity] = useState<CityLocation | null>(
    () => getDemoCityLocations()[0] ?? null,
  );
  const [report, setReport] = useState<AirQualityReport | null>(() =>
    initialDemoMode ? getDemoAirQualityReport("delhi") : null,
  );
  const [loadState, setLoadState] = useState<LoadState>(initialDemoMode ? "ready" : "loading");
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const { nextSignal } = useAsyncResource();

  const loadForLocation = useCallback(
    (location: CityLocation, useDemo: boolean) => {
      const signal = nextSignal();
      setSelectedCity(location);
      if (useDemo) {
        setReport(getDemoAirQualityReport(location));
        setLoadState("ready");
        return;
      }
      setLoadState("loading");
      void fetchLocationOutcome(location, false, signal).then((outcome) => {
        applyLoadOutcome(outcome, setReport, setRetryAfterSeconds, setLoadState);
      });
    },
    [nextSignal],
  );

  return {
    selectedCity,
    setSelectedCity,
    report,
    loadState,
    setLoadState,
    retryAfterSeconds,
    loadForLocation,
  };
}

function useAutoLoadEffect(
  loader: ReturnType<typeof useAirQualityLoader>,
  demoMode: boolean,
  initialDemoMode: boolean,
) {
  const skipInitialDemoRef = useRef(initialDemoMode);
  const { selectedCity, setLoadState, loadForLocation } = loader;

  useEffect(() => {
    if (skipInitialDemoRef.current) {
      skipInitialDemoRef.current = false;
      return;
    }
    if (!selectedCity) {
      setLoadState("empty");
      return;
    }
    loadForLocation(selectedCity, demoMode);
  }, [demoMode, loadForLocation, selectedCity, setLoadState]);
}

/** Orchestrates live or demo AQI report loading, offline snapshot fallback, and geolocation. */
export function useAirQualityData(initialDemoMode: boolean) {
  const [demoMode, setDemoMode] = useState(initialDemoMode);
  const loader = useAirQualityLoader(initialDemoMode);
  const { selectedCity, setSelectedCity, loadForLocation } = loader;
  useAutoLoadEffect(loader, demoMode, initialDemoMode);
  const { geoStatusMessageKey, requestUserLocation, clearGeoMessage } =
    useGeolocation(setSelectedCity);

  const selectCity = useCallback(
    (city: CityLocation) => {
      clearGeoMessage();
      setSelectedCity(city);
    },
    [clearGeoMessage, setSelectedCity],
  );

  const retry = useCallback(() => {
    if (selectedCity) loadForLocation(selectedCity, demoMode);
  }, [demoMode, loadForLocation, selectedCity]);

  return {
    demoMode,
    setDemoMode,
    selectedCity,
    report: loader.report,
    loadState: loader.loadState,
    retryAfterSeconds: loader.retryAfterSeconds,
    geoStatusMessageKey,
    selectCity,
    retry,
    requestUserLocation,
  };
}

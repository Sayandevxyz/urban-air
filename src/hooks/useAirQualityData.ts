"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AirQualityReport, CityLocation } from "@/domain/types";
import { getDemoAirQualityReport, getDemoCityLocations } from "@/services/demo-data";

export type LoadState = "loading" | "ready" | "empty" | "error" | "offline" | "rate_limited";

const SNAPSHOT_STORAGE_KEY = "urban-air:last-snapshot:v1";

interface AirQualityApiResponse {
  report?: AirQualityReport;
  error?: { code?: string; retryAfterSeconds?: number };
}

function readCachedSnapshot(): AirQualityReport | null {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AirQualityReport;
    if (typeof parsed.updatedAtIso === "string" && parsed.location.name) {
      return { ...parsed, source: "cached" };
    }
    return null;
  } catch {
    return null;
  }
}

function saveCachedSnapshot(report: AirQualityReport): void {
  try {
    // Only persist named city telemetry; never persist raw custom browser geolocation coordinates.
    if (report.location.key.startsWith("geo-self-")) {
      return;
    }
    window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(report));
  } catch {
    // Ignore storage quota restrictions.
  }
}

/**
 * Fetches live or demo air quality reports with automatic offline snapshot fallback and geolocation support.
 */
export function useAirQualityData(initialDemoMode: boolean) {
  const [demoMode, setDemoMode] = useState(initialDemoMode);
  const [selectedCity, setSelectedCity] = useState<CityLocation | null>(
    () => getDemoCityLocations()[0] ?? null,
  );
  const [report, setReport] = useState<AirQualityReport | null>(() =>
    initialDemoMode ? getDemoAirQualityReport("delhi") : null,
  );
  const [loadState, setLoadState] = useState<LoadState>(initialDemoMode ? "ready" : "loading");
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const [geoStatusMessageKey, setGeoStatusMessageKey] = useState<
    "none" | "locating" | "locationDenied" | "locationUnavailable"
  >("none");
  const abortRef = useRef<AbortController | null>(null);

  const fetchForLocation = useCallback(async (location: CityLocation, useDemo: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSelectedCity(location);

    if (useDemo) {
      const seeded = getDemoAirQualityReport(location);
      setReport(seeded);
      setLoadState("ready");
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const cached = readCachedSnapshot();
      if (cached) {
        setReport(cached);
        setLoadState("offline");
        return;
      }
      setLoadState("error");
      return;
    }

    setLoadState("loading");
    const params = new URLSearchParams({
      lat: String(location.latitude),
      lon: String(location.longitude),
      name: location.name,
      region: location.region,
      country: location.country,
      timezone: location.timezone,
      demo: "false",
    });
    if (!location.key.startsWith("geo-self-") && !location.key.startsWith("loc-")) {
      params.set("cityKey", location.key);
    }

    try {
      const res = await fetch(`/api/air-quality?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = (await res.json()) as AirQualityApiResponse;

      if (res.status === 429) {
        setRetryAfterSeconds(data.error?.retryAfterSeconds ?? 30);
        setLoadState("rate_limited");
        return;
      }
      if (!res.ok || !data.report) {
        const cached = readCachedSnapshot();
        if (cached && cached.location.key === location.key) {
          setReport(cached);
          setLoadState("offline");
          return;
        }
        setLoadState("error");
        return;
      }

      saveCachedSnapshot(data.report);
      setReport(data.report);
      setLoadState("ready");
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      const cached = readCachedSnapshot();
      if (cached) {
        setReport(cached);
        setLoadState("offline");
        return;
      }
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    if (selectedCity) {
      void fetchForLocation(selectedCity, demoMode);
    } else {
      setLoadState("empty");
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [demoMode, fetchForLocation, selectedCity]);

  const selectCity = useCallback((city: CityLocation) => {
    setGeoStatusMessageKey("none");
    setSelectedCity(city);
  }, []);

  const retry = useCallback(() => {
    if (selectedCity) {
      void fetchForLocation(selectedCity, demoMode);
    }
  }, [demoMode, fetchForLocation, selectedCity]);

  const requestUserLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoStatusMessageKey("locationUnavailable");
      return;
    }

    setGeoStatusMessageKey("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoStatusMessageKey("none");
        const customLoc: CityLocation = {
          key: "geo-self-current",
          name: "Current Location",
          region: "",
          country: "",
          latitude: Math.round(position.coords.latitude * 100) / 100,
          longitude: Math.round(position.coords.longitude * 100) / 100,
          timezone: "auto",
        };
        setSelectedCity(customLoc);
      },
      (geoError) => {
        setGeoStatusMessageKey(
          geoError.code === geoError.PERMISSION_DENIED ? "locationDenied" : "locationUnavailable",
        );
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 60_000 },
    );
  }, []);

  return {
    demoMode,
    setDemoMode,
    selectedCity,
    report,
    loadState,
    retryAfterSeconds,
    geoStatusMessageKey,
    selectCity,
    retry,
    requestUserLocation,
  };
}

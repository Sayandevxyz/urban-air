"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AirQualityReport, CityLocation } from "@/domain/types";
import { fetchAirQuality } from "@/hooks/fetchAirQuality";
import { MAX_COMPARE_CITIES } from "@/lib/constants";
import { getDemoAirQualityReport, getDemoCityLocations } from "@/services/demo-data";

function buildDemoReportMap(
  targetCities: readonly CityLocation[],
): Record<string, AirQualityReport> {
  const next: Record<string, AirQualityReport> = {};
  for (const city of targetCities) {
    next[city.key] = getDemoAirQualityReport(city);
  }
  return next;
}

async function fetchLiveReportMap(
  targetCities: readonly CityLocation[],
): Promise<Record<string, AirQualityReport>> {
  const entries = await Promise.all(
    targetCities.map(async (city) => {
      const result = await fetchAirQuality(city, false);
      return [city.key, result.ok ? result.data : getDemoAirQualityReport(city)] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Manages up to 3 cities compared side by side, fetching reports in parallel without waterfalls.
 */
export function useCityComparison(demoMode: boolean) {
  const defaultCompare = getDemoCityLocations().slice(0, 2);
  const [cities, setCities] = useState<readonly CityLocation[]>(defaultCompare);
  const [reports, setReports] = useState<Readonly<Record<string, AirQualityReport>>>(() =>
    buildDemoReportMap(defaultCompare),
  );
  const [loading, setLoading] = useState(false);
  const skipInitialDemoRef = useRef(demoMode);

  useEffect(() => {
    if (skipInitialDemoRef.current) {
      skipInitialDemoRef.current = false;
      return;
    }
    if (cities.length === 0) {
      setReports({});
      return;
    }
    if (demoMode) {
      setReports(buildDemoReportMap(cities));
      return;
    }
    setLoading(true);
    void fetchLiveReportMap(cities).then((next) => {
      setReports(next);
      setLoading(false);
    });
  }, [cities, demoMode]);

  const addCity = useCallback((city: CityLocation) => {
    setCities((prev) =>
      prev.length >= MAX_COMPARE_CITIES || prev.some((item) => item.key === city.key)
        ? prev
        : [...prev, city],
    );
  }, []);

  const removeCity = useCallback((cityKey: string) => {
    setCities((prev) => prev.filter((item) => item.key !== cityKey));
  }, []);

  return { cities, reports, loading, addCity, removeCity };
}

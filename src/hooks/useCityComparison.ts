"use client";

import { useCallback, useEffect, useState } from "react";
import type { AirQualityReport, CityLocation } from "@/domain/types";
import { MAX_COMPARE_CITIES } from "@/lib/constants";
import { getDemoAirQualityReport, getDemoCityLocations } from "@/services/demo-data";

/**
 * Manages up to 3 cities compared side by side, fetching reports in parallel without waterfalls.
 */
export function useCityComparison(demoMode: boolean) {
  const defaultCompare = getDemoCityLocations().slice(0, 2);
  const [cities, setCities] = useState<readonly CityLocation[]>(defaultCompare);
  const [reports, setReports] = useState<Readonly<Record<string, AirQualityReport>>>(() => {
    const initial: Record<string, AirQualityReport> = {};
    for (const city of defaultCompare) {
      initial[city.key] = getDemoAirQualityReport(city);
    }
    return initial;
  });
  const [loading, setLoading] = useState(false);

  const fetchCitiesParallel = useCallback(
    async (targetCities: readonly CityLocation[], isDemo: boolean) => {
      if (targetCities.length === 0) {
        setReports({});
        return;
      }

      if (isDemo) {
        const next: Record<string, AirQualityReport> = {};
        for (const city of targetCities) {
          next[city.key] = getDemoAirQualityReport(city);
        }
        setReports(next);
        return;
      }

      setLoading(true);
      try {
        const fetched = await Promise.all(
          targetCities.map(async (city) => {
            const params = new URLSearchParams({
              lat: String(city.latitude),
              lon: String(city.longitude),
              name: city.name,
              region: city.region,
              country: city.country,
              timezone: city.timezone,
              demo: "false",
            });
            if (!city.key.startsWith("geo-self-") && !city.key.startsWith("loc-")) {
              params.set("cityKey", city.key);
            }
            const res = await fetch(`/api/air-quality?${params.toString()}`);
            if (!res.ok) {
              return [city.key, getDemoAirQualityReport(city)] as const;
            }
            const json = (await res.json()) as { report?: AirQualityReport };
            return [city.key, json.report ?? getDemoAirQualityReport(city)] as const;
          }),
        );
        const next: Record<string, AirQualityReport> = {};
        for (const [key, value] of fetched) {
          next[key] = value;
        }
        setReports(next);
      } catch {
        const fallback: Record<string, AirQualityReport> = {};
        for (const city of targetCities) {
          fallback[city.key] = getDemoAirQualityReport(city);
        }
        setReports(fallback);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchCitiesParallel(cities, demoMode);
  }, [cities, demoMode, fetchCitiesParallel]);

  const addCity = useCallback((city: CityLocation) => {
    setCities((prev) => {
      if (prev.length >= MAX_COMPARE_CITIES || prev.some((item) => item.key === city.key)) {
        return prev;
      }
      return [...prev, city];
    });
  }, []);

  const removeCity = useCallback((cityKey: string) => {
    setCities((prev) => prev.filter((item) => item.key !== cityKey));
  }, []);

  return { cities, reports, loading, addCity, removeCity };
}

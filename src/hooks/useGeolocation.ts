"use client";

import { useCallback, useState } from "react";
import { COORDINATE_ROUND_FACTOR, GEO_MAX_AGE_MS, GEO_TIMEOUT_MS } from "@/lib/constants";
import type { CityLocation } from "@/types/air-quality";

export type GeoStatusKey = "none" | "locating" | "locationDenied" | "locationUnavailable";

/**
 * Requests browser geolocation without persisting device coordinates and calls back on success.
 */
export function useGeolocation(onLocated: (city: CityLocation) => void) {
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
          latitude:
            Math.round(position.coords.latitude * COORDINATE_ROUND_FACTOR) /
            COORDINATE_ROUND_FACTOR,
          longitude:
            Math.round(position.coords.longitude * COORDINATE_ROUND_FACTOR) /
            COORDINATE_ROUND_FACTOR,
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

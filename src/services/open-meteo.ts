import {
  AQI_CACHE_STALE_TTL_MS,
  AQI_CACHE_TTL_MS,
  GEOCODING_CACHE_STALE_TTL_MS,
  GEOCODING_CACHE_TTL_MS,
  TREND_DAYS_WINDOW,
} from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { err, ok, type Result } from "@/lib/errors";
import { SwrMemoryCache } from "@/services/cache";
import { fetchJsonWithGuard } from "@/services/http";
import {
  mapOpenMeteoLocations,
  mapOpenMeteoReport,
  openMeteoCurrentSchema,
  openMeteoGeocodeSchema,
  openMeteoHourlySchema,
  roundCoord,
} from "@/services/openMeteoMapper";
import type { AirQualityReport, CityLocation } from "@/types/air-quality";
import type { AirQualityProvider, GeocodingProvider } from "@/types/api";

const geocodeCache = new SwrMemoryCache<Result<readonly CityLocation[]>>();
const airQualityCache = new SwrMemoryCache<Result<AirQualityReport>>();

function buildGeocodeUrl(baseUrl: string, query: string): string {
  const url = new URL(`${baseUrl}/search`);
  url.searchParams.set("name", query.trim());
  url.searchParams.set("count", "6");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  return url.toString();
}

function buildAirQualityUrl(
  baseUrl: string,
  lat: number,
  lon: number,
  params: Readonly<Record<string, string>>,
): string {
  const url = new URL(`${baseUrl}/air-quality`);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("timezone", "auto");
  return url.toString();
}

/**
 * Default Open-Meteo geocoding adapter backed by 24-hour SWR caching and deduplication.
 */
export const openMeteoGeocodingProvider: GeocodingProvider = {
  providerName: "open-meteo-geocoding",
  searchCities(query: string, signal?: AbortSignal): Promise<Result<readonly CityLocation[]>> {
    const cacheKey = `geo:${query.trim().toLowerCase()}`;
    return geocodeCache.getOrFetch(
      cacheKey,
      { ttlMs: GEOCODING_CACHE_TTL_MS, staleTtlMs: GEOCODING_CACHE_STALE_TTL_MS },
      async () => {
        const url = buildGeocodeUrl(getEnv().OPEN_METEO_GEOCODING_BASE_URL, query);
        const result = await fetchJsonWithGuard(url, openMeteoGeocodeSchema, { signal });
        return result.ok ? ok(mapOpenMeteoLocations(result.value)) : result;
      },
      (res) => res.ok,
    );
  },
};

/**
 * Default Open-Meteo air quality adapter fetching current readings and 7-day forecasts in parallel.
 */
export const openMeteoAirQualityProvider: AirQualityProvider = {
  providerName: "open-meteo-air-quality",
  fetchAirQuality(location: CityLocation, signal?: AbortSignal): Promise<Result<AirQualityReport>> {
    const lat = roundCoord(location.latitude);
    const lon = roundCoord(location.longitude);
    return airQualityCache.getOrFetch(
      `aqi:${lat}:${lon}`,
      { ttlMs: AQI_CACHE_TTL_MS, staleTtlMs: AQI_CACHE_STALE_TTL_MS },
      async () => {
        const base = getEnv().OPEN_METEO_AIR_QUALITY_BASE_URL;
        const [currentRes, forecastRes] = await Promise.all([
          fetchJsonWithGuard(
            buildAirQualityUrl(base, lat, lon, {
              current:
                "us_aqi,european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide",
            }),
            openMeteoCurrentSchema,
            { signal },
          ),
          fetchJsonWithGuard(
            buildAirQualityUrl(base, lat, lon, {
              hourly: "us_aqi,european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone",
              forecast_days: String(TREND_DAYS_WINDOW),
            }),
            openMeteoHourlySchema,
            { signal },
          ),
        ]);
        if (!currentRes.ok) return err(currentRes.error);
        if (!forecastRes.ok) return err(forecastRes.error);
        return ok(mapOpenMeteoReport(location, currentRes.value, forecastRes.value));
      },
      (res) => res.ok,
    );
  },
};

/**
 * Clears cached Open-Meteo geocoding and air quality entries (used by integration tests).
 */
export function clearOpenMeteoCaches(): void {
  geocodeCache.clear();
  airQualityCache.clear();
}

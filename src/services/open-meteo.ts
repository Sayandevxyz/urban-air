import type { AirQualityReport, CityLocation } from "@/domain/types";
import {
  AQI_CACHE_STALE_TTL_MS,
  AQI_CACHE_TTL_MS,
  GEOCODING_CACHE_STALE_TTL_MS,
  GEOCODING_CACHE_TTL_MS,
  TREND_DAYS_WINDOW,
} from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { err, ok, type Result } from "@/lib/errors";
import { sharedServerCache, type SwrMemoryCache } from "@/services/cache";
import { fetchJsonWithGuard } from "@/services/http";
import {
  mapOpenMeteoLocations,
  mapOpenMeteoReport,
  openMeteoCurrentSchema,
  openMeteoGeocodeSchema,
  openMeteoHourlySchema,
  roundCoord,
} from "@/services/openMeteoMapper";
import type { AirQualityProvider, GeocodingProvider } from "@/services/providers";

function buildGeocodeUrl(baseUrl: string, query: string): string {
  const url = new URL(`${baseUrl}/search`);
  url.searchParams.set("name", query.trim());
  url.searchParams.set("count", "6");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  return url.toString();
}

function buildCurrentUrl(baseUrl: string, lat: number, lon: number): string {
  const url = new URL(`${baseUrl}/air-quality`);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "current",
    "us_aqi,european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide",
  );
  url.searchParams.set("timezone", "auto");
  return url.toString();
}

function buildForecastUrl(baseUrl: string, lat: number, lon: number): string {
  const url = new URL(`${baseUrl}/air-quality`);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("hourly", "us_aqi,european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone");
  url.searchParams.set("forecast_days", String(TREND_DAYS_WINDOW));
  url.searchParams.set("timezone", "auto");
  return url.toString();
}

/**
 * Geocoding provider backed by Open-Meteo Geocoding API with 24-hour SWR caching.
 */
export class OpenMeteoGeocodingProvider implements GeocodingProvider {
  public readonly providerName = "open-meteo-geocoding";
  private readonly cache: SwrMemoryCache;

  public constructor(cache: SwrMemoryCache = sharedServerCache) {
    this.cache = cache;
  }

  /**
   * Searches urban locations matching the query string with caching and deduplication.
   */
  public async searchCities(
    query: string,
    signal?: AbortSignal,
  ): Promise<Result<readonly CityLocation[]>> {
    const cacheKey = `geo:${query.trim().toLowerCase()}`;
    return this.cache.getOrFetch(
      cacheKey,
      { ttlMs: GEOCODING_CACHE_TTL_MS, staleTtlMs: GEOCODING_CACHE_STALE_TTL_MS },
      async () => {
        const env = getEnv();
        const url = buildGeocodeUrl(env.OPEN_METEO_GEOCODING_BASE_URL, query);
        const result = await fetchJsonWithGuard(url, openMeteoGeocodeSchema, { signal });
        if (!result.ok) {
          return result;
        }
        return ok(mapOpenMeteoLocations(result.value));
      },
      (res) => res.ok,
    );
  }
}

/**
 * Air quality provider backed by Open-Meteo Air Quality API using parallel fetches and 10-min cache.
 */
export class OpenMeteoAirQualityProvider implements AirQualityProvider {
  public readonly providerName = "open-meteo-air-quality";
  private readonly cache: SwrMemoryCache;

  public constructor(cache: SwrMemoryCache = sharedServerCache) {
    this.cache = cache;
  }

  /**
   * Fetches current pollutant snapshot and 7-day hourly forecast in parallel (zero waterfall).
   */
  public async fetchAirQuality(
    location: CityLocation,
    signal?: AbortSignal,
  ): Promise<Result<AirQualityReport>> {
    const lat = roundCoord(location.latitude);
    const lon = roundCoord(location.longitude);
    return this.cache.getOrFetch(
      `aqi:${lat}:${lon}`,
      { ttlMs: AQI_CACHE_TTL_MS, staleTtlMs: AQI_CACHE_STALE_TTL_MS },
      async () => {
        const base = getEnv().OPEN_METEO_AIR_QUALITY_BASE_URL;
        const [currentRes, forecastRes] = await Promise.all([
          fetchJsonWithGuard(buildCurrentUrl(base, lat, lon), openMeteoCurrentSchema, { signal }),
          fetchJsonWithGuard(buildForecastUrl(base, lat, lon), openMeteoHourlySchema, { signal }),
        ]);
        if (!currentRes.ok) return err(currentRes.error);
        if (!forecastRes.ok) return err(forecastRes.error);
        return ok(mapOpenMeteoReport(location, currentRes.value, forecastRes.value));
      },
      (res) => res.ok,
    );
  }
}

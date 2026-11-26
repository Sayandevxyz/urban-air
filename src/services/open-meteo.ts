import { z } from "zod";
import { computeCompositeUsAqi, estimateEuropeanAqiFromPollutants } from "@/domain/aqi";
import type {
  AirQualityReport,
  CityLocation,
  DailyTrendPoint,
  HourlyForecastPoint,
  PollutantReadings,
} from "@/domain/types";
import {
  AQI_CACHE_STALE_TTL_MS,
  AQI_CACHE_TTL_MS,
  COORDINATE_CACHE_DECIMALS,
  FORECAST_HOURS_WINDOW,
  GEOCODING_CACHE_STALE_TTL_MS,
  GEOCODING_CACHE_TTL_MS,
  TREND_DAYS_WINDOW,
} from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { err, ok, type Result } from "@/lib/errors";
import { sharedServerCache, type SwrMemoryCache } from "@/services/cache";
import { fetchJsonWithGuard } from "@/services/http";
import type { AirQualityProvider, GeocodingProvider } from "@/services/providers";

const openMeteoGeocodeSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number().optional(),
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
        admin1: z.string().optional(),
        timezone: z.string().optional(),
      }),
    )
    .optional(),
});

const openMeteoCurrentSchema = z.object({
  current: z.object({
    time: z.string(),
    us_aqi: z.number().nullable().optional(),
    european_aqi: z.number().nullable().optional(),
    pm2_5: z.number().nullable().optional(),
    pm10: z.number().nullable().optional(),
    nitrogen_dioxide: z.number().nullable().optional(),
    ozone: z.number().nullable().optional(),
    sulphur_dioxide: z.number().nullable().optional(),
    carbon_monoxide: z.number().nullable().optional(),
  }),
});

const openMeteoHourlySchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    us_aqi: z.array(z.number().nullable()).optional(),
    european_aqi: z.array(z.number().nullable()).optional(),
    pm2_5: z.array(z.number().nullable()).optional(),
    pm10: z.array(z.number().nullable()).optional(),
    nitrogen_dioxide: z.array(z.number().nullable()).optional(),
    ozone: z.array(z.number().nullable()).optional(),
  }),
});

function roundCoord(value: number): number {
  const factor = 10 ** COORDINATE_CACHE_DECIMALS;
  return Math.round(value * factor) / factor;
}

function slugifyCityKey(name: string, lat: number, lon: number): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "loc"}-${Math.round(lat * 10)}-${Math.round(lon * 10)}`;
}

function safeNumber(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function aggregateDailyTrends(hourly: readonly HourlyForecastPoint[]): readonly DailyTrendPoint[] {
  const byDate = new Map<string, HourlyForecastPoint[]>();
  for (const point of hourly) {
    const dateIso = point.timeIso.slice(0, 10);
    const list = byDate.get(dateIso);
    if (list) {
      list.push(point);
    } else {
      byDate.set(dateIso, [point]);
    }
  }

  const daily: DailyTrendPoint[] = [];
  for (const [dateIso, points] of byDate.entries()) {
    if (daily.length >= TREND_DAYS_WINDOW) {
      break;
    }
    let sumAqi = 0;
    let sumPm25 = 0;
    let maxUsAqi = 0;
    let minUsAqi = Number.POSITIVE_INFINITY;
    for (const p of points) {
      sumAqi += p.usAqi;
      sumPm25 += p.pm25;
      if (p.usAqi > maxUsAqi) maxUsAqi = p.usAqi;
      if (p.usAqi < minUsAqi) minUsAqi = p.usAqi;
    }
    daily.push({
      dateIso,
      avgUsAqi: Math.round(sumAqi / points.length),
      maxUsAqi,
      minUsAqi: Number.isFinite(minUsAqi) ? minUsAqi : 0,
      avgPm25: Math.round((sumPm25 / points.length) * 10) / 10,
    });
  }
  return daily;
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
    const normalized = query.trim().toLowerCase();
    const cacheKey = `geo:${normalized}`;

    return this.cache.getOrFetch(
      cacheKey,
      { ttlMs: GEOCODING_CACHE_TTL_MS, staleTtlMs: GEOCODING_CACHE_STALE_TTL_MS },
      async () => {
        const env = getEnv();
        const url = new URL(`${env.OPEN_METEO_GEOCODING_BASE_URL}/search`);
        url.searchParams.set("name", query.trim());
        url.searchParams.set("count", "6");
        url.searchParams.set("language", "en");
        url.searchParams.set("format", "json");

        const result = await fetchJsonWithGuard(url.toString(), openMeteoGeocodeSchema, { signal });
        if (!result.ok) {
          return result;
        }

        const items = result.value.results ?? [];
        const locations: CityLocation[] = items.map((item) => ({
          key: slugifyCityKey(item.name, item.latitude, item.longitude),
          name: item.name,
          region: item.admin1 ?? "",
          country: item.country ?? "",
          latitude: roundCoord(item.latitude),
          longitude: roundCoord(item.longitude),
          timezone: item.timezone ?? "UTC",
        }));
        return ok(locations);
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
    const cacheKey = `aqi:${lat}:${lon}`;

    return this.cache.getOrFetch(
      cacheKey,
      { ttlMs: AQI_CACHE_TTL_MS, staleTtlMs: AQI_CACHE_STALE_TTL_MS },
      async () => {
        const env = getEnv();
        const currentUrl = new URL(`${env.OPEN_METEO_AIR_QUALITY_BASE_URL}/air-quality`);
        currentUrl.searchParams.set("latitude", String(lat));
        currentUrl.searchParams.set("longitude", String(lon));
        currentUrl.searchParams.set(
          "current",
          "us_aqi,european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide",
        );
        currentUrl.searchParams.set("timezone", "auto");

        const forecastUrl = new URL(`${env.OPEN_METEO_AIR_QUALITY_BASE_URL}/air-quality`);
        forecastUrl.searchParams.set("latitude", String(lat));
        forecastUrl.searchParams.set("longitude", String(lon));
        forecastUrl.searchParams.set(
          "hourly",
          "us_aqi,european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone",
        );
        forecastUrl.searchParams.set("forecast_days", String(TREND_DAYS_WINDOW));
        forecastUrl.searchParams.set("timezone", "auto");

        const [currentRes, forecastRes] = await Promise.all([
          fetchJsonWithGuard(currentUrl.toString(), openMeteoCurrentSchema, { signal }),
          fetchJsonWithGuard(forecastUrl.toString(), openMeteoHourlySchema, { signal }),
        ]);

        if (!currentRes.ok) {
          return err(currentRes.error);
        }
        if (!forecastRes.ok) {
          return err(forecastRes.error);
        }

        return ok(this.mapResponse(location, currentRes.value, forecastRes.value));
      },
      (res) => res.ok,
    );
  }

  private mapResponse(
    location: CityLocation,
    currentPayload: z.infer<typeof openMeteoCurrentSchema>,
    hourlyPayload: z.infer<typeof openMeteoHourlySchema>,
  ): AirQualityReport {
    const readings: PollutantReadings = {
      pm25: safeNumber(currentPayload.current.pm2_5),
      pm10: safeNumber(currentPayload.current.pm10),
      no2: safeNumber(currentPayload.current.nitrogen_dioxide),
      o3: safeNumber(currentPayload.current.ozone),
      so2: safeNumber(currentPayload.current.sulphur_dioxide),
      co: safeNumber(currentPayload.current.carbon_monoxide),
    };

    const computedUsAqi = computeCompositeUsAqi(readings);
    const usAqi = Math.round(safeNumber(currentPayload.current.us_aqi, computedUsAqi));
    const europeanAqi = Math.round(
      safeNumber(currentPayload.current.european_aqi, estimateEuropeanAqiFromPollutants(readings)),
    );

    const h = hourlyPayload.hourly;
    const allHourly: HourlyForecastPoint[] = h.time.map((timeIso, index) => {
      const pm25 = safeNumber(h.pm2_5?.[index]);
      const pm10 = safeNumber(h.pm10?.[index]);
      const no2 = safeNumber(h.nitrogen_dioxide?.[index]);
      const o3 = safeNumber(h.ozone?.[index]);
      const pointReadings: PollutantReadings = { pm25, pm10, no2, o3, so2: 0, co: 0 };
      const fallbackUs = computeCompositeUsAqi(pointReadings);
      const fallbackEu = estimateEuropeanAqiFromPollutants(pointReadings);
      return {
        timeIso,
        usAqi: Math.round(safeNumber(h.us_aqi?.[index], fallbackUs)),
        europeanAqi: Math.round(safeNumber(h.european_aqi?.[index], fallbackEu)),
        pm25,
        pm10,
        no2,
        o3,
      };
    });

    return {
      location,
      updatedAtIso: currentPayload.current.time,
      source: "open-meteo",
      current: { usAqi, europeanAqi, readings },
      hourly: allHourly.slice(0, FORECAST_HOURS_WINDOW),
      daily: aggregateDailyTrends(allHourly),
    };
  }
}

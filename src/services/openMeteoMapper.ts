import { z } from "zod";
import { computeCompositeUsAqi, estimateEuropeanAqiFromPollutants } from "@/domain/aqiBreakpoints";
import {
  COORDINATE_CACHE_DECIMALS,
  FORECAST_HOURS_WINDOW,
  TREND_DAYS_WINDOW,
} from "@/lib/constants";
import type {
  AirQualityReport,
  CityLocation,
  DailyTrendPoint,
  HourlyForecastPoint,
  PollutantReadings,
} from "@/types/air-quality";

export const openMeteoGeocodeSchema = z.object({
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

export const openMeteoCurrentSchema = z.object({
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

export const openMeteoHourlySchema = z.object({
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

/**
 * Rounds coordinates consistently for SWR cache keys and privacy preservation.
 */
export function roundCoord(value: number): number {
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

function summarizeDayPoints(
  dateIso: string,
  points: readonly HourlyForecastPoint[],
): DailyTrendPoint {
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
  return {
    dateIso,
    avgUsAqi: Math.round(sumAqi / points.length),
    maxUsAqi,
    minUsAqi: Number.isFinite(minUsAqi) ? minUsAqi : 0,
    avgPm25: Math.round((sumPm25 / points.length) * 10) / 10,
  };
}

function aggregateDailyTrends(hourly: readonly HourlyForecastPoint[]): readonly DailyTrendPoint[] {
  const byDate = new Map<string, HourlyForecastPoint[]>();
  for (const point of hourly) {
    const dateIso = point.timeIso.slice(0, 10);
    const list = byDate.get(dateIso);
    if (list) list.push(point);
    else byDate.set(dateIso, [point]);
  }
  const daily: DailyTrendPoint[] = [];
  for (const [dateIso, points] of byDate.entries()) {
    if (daily.length >= TREND_DAYS_WINDOW) break;
    daily.push(summarizeDayPoints(dateIso, points));
  }
  return daily;
}

/**
 * Maps validated Open-Meteo geocoding payloads to canonical CityLocation models.
 */
export function mapOpenMeteoLocations(
  payload: z.infer<typeof openMeteoGeocodeSchema>,
): readonly CityLocation[] {
  const items = payload.results ?? [];
  return items.map((item) => ({
    key: slugifyCityKey(item.name, item.latitude, item.longitude),
    name: item.name,
    region: item.admin1 ?? "",
    country: item.country ?? "",
    latitude: roundCoord(item.latitude),
    longitude: roundCoord(item.longitude),
    timezone: item.timezone ?? "UTC",
  }));
}

function mapHourlyPoint(
  timeIso: string,
  index: number,
  hourly: z.infer<typeof openMeteoHourlySchema>["hourly"],
): HourlyForecastPoint {
  const pm25 = safeNumber(hourly.pm2_5?.[index]);
  const pm10 = safeNumber(hourly.pm10?.[index]);
  const no2 = safeNumber(hourly.nitrogen_dioxide?.[index]);
  const o3 = safeNumber(hourly.ozone?.[index]);
  const pointReadings: PollutantReadings = { pm25, pm10, no2, o3, so2: 0, co: 0 };
  const fallbackUs = computeCompositeUsAqi(pointReadings);
  const fallbackEu = estimateEuropeanAqiFromPollutants(pointReadings);
  return {
    timeIso,
    usAqi: Math.round(safeNumber(hourly.us_aqi?.[index], fallbackUs)),
    europeanAqi: Math.round(safeNumber(hourly.european_aqi?.[index], fallbackEu)),
    pm25,
    pm10,
    no2,
    o3,
  };
}

/**
 * Maps validated Open-Meteo current and hourly payloads into a canonical AirQualityReport.
 */
export function mapOpenMeteoReport(
  location: CityLocation,
  currentPayload: z.infer<typeof openMeteoCurrentSchema>,
  hourlyPayload: z.infer<typeof openMeteoHourlySchema>,
): AirQualityReport {
  const current = currentPayload.current;
  const readings: PollutantReadings = {
    pm25: safeNumber(current.pm2_5),
    pm10: safeNumber(current.pm10),
    no2: safeNumber(current.nitrogen_dioxide),
    o3: safeNumber(current.ozone),
    so2: safeNumber(current.sulphur_dioxide),
    co: safeNumber(current.carbon_monoxide),
  };
  const computedUsAqi = computeCompositeUsAqi(readings);
  const usAqi = Math.round(safeNumber(current.us_aqi, computedUsAqi));
  const europeanAqi = Math.round(
    safeNumber(current.european_aqi, estimateEuropeanAqiFromPollutants(readings)),
  );
  const allHourly = hourlyPayload.hourly.time.map((timeIso, index) =>
    mapHourlyPoint(timeIso, index, hourlyPayload.hourly),
  );
  return {
    location,
    updatedAtIso: current.time,
    source: "open-meteo",
    current: { usAqi, europeanAqi, readings },
    hourly: allHourly.slice(0, FORECAST_HOURS_WINDOW),
    daily: aggregateDailyTrends(allHourly),
  };
}

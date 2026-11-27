import { FORECAST_HOURS_WINDOW, TREND_DAYS_WINDOW } from "@/lib/constants";
import {
  DEMO_CITY_SEEDS,
  DEMO_REFERENCE_START_ISO,
  type DemoCitySeed,
} from "@/services/demo-seeds";
import type {
  AirQualityReport,
  CityLocation,
  DailyTrendPoint,
  HourlyForecastPoint,
} from "@/types/air-quality";

function buildDiurnalFactor(hourOfDay: number, amplitude: number): number {
  const afternoonCleanerWave = Math.cos(((hourOfDay - 15) / 24) * Math.PI * 2);
  return 1 - amplitude * (0.5 + 0.5 * afternoonCleanerWave);
}

function generateHourlySeries(seed: DemoCitySeed): readonly HourlyForecastPoint[] {
  const baseTimeMs = Date.parse(DEMO_REFERENCE_START_ISO);
  const points: HourlyForecastPoint[] = [];

  for (let offset = 0; offset < FORECAST_HOURS_WINDOW; offset += 1) {
    const pointDate = new Date(baseTimeMs + offset * 3_600_000);
    const hourOfDay = pointDate.getUTCHours();
    const factor = buildDiurnalFactor(hourOfDay, seed.diurnalAmplitude);
    const afternoonOzoneBoost = hourOfDay >= 12 && hourOfDay <= 17 ? 1.25 : 0.85;

    points.push({
      timeIso: pointDate.toISOString(),
      usAqi: Math.max(12, Math.round(seed.baseUsAqi * factor)),
      europeanAqi: Math.max(8, Math.round(seed.baseEuropeanAqi * factor)),
      pm25: Math.round(seed.baseReadings.pm25 * factor * 10) / 10,
      pm10: Math.round(seed.baseReadings.pm10 * factor),
      no2: Math.round(seed.baseReadings.no2 * factor),
      o3: Math.round(seed.baseReadings.o3 * afternoonOzoneBoost),
    });
  }

  return points;
}

function generateDailySeries(seed: DemoCitySeed): readonly DailyTrendPoint[] {
  const baseTimeMs = Date.parse(DEMO_REFERENCE_START_ISO);
  const dayMultipliers = [1.0, 0.94, 0.88, 0.96, 1.05, 0.9, 0.84];
  const points: DailyTrendPoint[] = [];

  for (let day = 0; day < TREND_DAYS_WINDOW; day += 1) {
    const date = new Date(baseTimeMs + day * 86_400_000);
    const mult = dayMultipliers[day] ?? 1.0;
    const avgUsAqi = Math.max(15, Math.round(seed.baseUsAqi * mult));
    const maxUsAqi = Math.round(avgUsAqi * (1 + seed.diurnalAmplitude * 0.45));
    const minUsAqi = Math.max(10, Math.round(avgUsAqi * (1 - seed.diurnalAmplitude * 0.75)));
    const avgPm25 = Math.round(seed.baseReadings.pm25 * mult * 10) / 10;

    points.push({
      dateIso: date.toISOString().slice(0, 10),
      avgUsAqi,
      maxUsAqi,
      minUsAqi,
      avgPm25,
    });
  }

  return points;
}

/**
 * Lists all five built-in Demo Mode city locations.
 */
export function getDemoCityLocations(): readonly CityLocation[] {
  return DEMO_CITY_SEEDS.map((seed) => seed.location);
}

/**
 * Searches built-in Demo Mode cities matching a query string (used offline or in Demo Mode).
 */
export function searchDemoCities(query: string): readonly CityLocation[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return getDemoCityLocations();
  }
  return DEMO_CITY_SEEDS.filter(
    (seed) =>
      seed.location.name.toLowerCase().includes(normalized) ||
      seed.location.country.toLowerCase().includes(normalized) ||
      seed.location.region.toLowerCase().includes(normalized),
  ).map((seed) => seed.location);
}

/**
 * Returns a seeded realistic AirQualityReport for a built-in Demo Mode city key or location.
 */
export function getDemoAirQualityReport(
  cityKeyOrLocation: string | CityLocation,
): AirQualityReport {
  const targetKey =
    typeof cityKeyOrLocation === "string"
      ? cityKeyOrLocation.toLowerCase()
      : cityKeyOrLocation.key.toLowerCase();

  const matchedSeed =
    DEMO_CITY_SEEDS.find((seed) => seed.location.key === targetKey) ??
    findClosestDemoSeed(cityKeyOrLocation);

  const location = typeof cityKeyOrLocation === "string" ? matchedSeed.location : cityKeyOrLocation;

  return {
    location,
    updatedAtIso: "2026-11-26T08:00:00Z",
    source: "demo",
    current: {
      usAqi: matchedSeed.baseUsAqi,
      europeanAqi: matchedSeed.baseEuropeanAqi,
      readings: matchedSeed.baseReadings,
    },
    hourly: generateHourlySeries(matchedSeed),
    daily: generateDailySeries(matchedSeed),
  };
}

function findClosestDemoSeed(cityKeyOrLocation: string | CityLocation): DemoCitySeed {
  const fallbackSeed = DEMO_CITY_SEEDS[0];
  if (!fallbackSeed) {
    throw new Error("DEMO_CITY_SEEDS must contain at least one city.");
  }
  if (typeof cityKeyOrLocation === "string") {
    return fallbackSeed;
  }

  let bestSeed: DemoCitySeed = fallbackSeed;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const seed of DEMO_CITY_SEEDS) {
    const dLat = seed.location.latitude - cityKeyOrLocation.latitude;
    const dLon = seed.location.longitude - cityKeyOrLocation.longitude;
    const dist = dLat * dLat + dLon * dLon;
    if (dist < bestDistance) {
      bestDistance = dist;
      bestSeed = seed;
    }
  }

  return bestSeed;
}

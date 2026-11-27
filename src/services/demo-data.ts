import { FORECAST_HOURS_WINDOW, TREND_DAYS_WINDOW } from "@/lib/constants";
import type {
  AirQualityReport,
  CityLocation,
  DailyTrendPoint,
  HourlyForecastPoint,
  PollutantReadings,
} from "@/types/air-quality";

interface DemoCitySeed {
  readonly location: CityLocation;
  readonly baseReadings: PollutantReadings;
  readonly baseUsAqi: number;
  readonly baseEuropeanAqi: number;
  readonly diurnalAmplitude: number;
}

const DEMO_REFERENCE_START_ISO = "2026-11-26T00:00:00Z";

function createSeed(
  loc: readonly [string, string, string, string, number, number, string],
  pol: readonly [number, number, number, number, number, number],
  aqi: readonly [number, number, number],
): DemoCitySeed {
  return {
    location: {
      key: loc[0],
      name: loc[1],
      region: loc[2],
      country: loc[3],
      latitude: loc[4],
      longitude: loc[5],
      timezone: loc[6],
    },
    baseReadings: {
      pm25: pol[0],
      pm10: pol[1],
      no2: pol[2],
      o3: pol[3],
      so2: pol[4],
      co: pol[5],
    },
    baseUsAqi: aqi[0],
    baseEuropeanAqi: aqi[1],
    diurnalAmplitude: aqi[2],
  };
}

const DEMO_CITY_SEEDS: readonly DemoCitySeed[] = [
  createSeed(
    ["delhi", "Delhi", "Delhi", "India", 28.61, 77.21, "Asia/Kolkata"],
    [158, 278, 92, 38, 24, 2450],
    [224, 108, 0.34],
  ),
  createSeed(
    ["coimbatore", "Coimbatore", "Tamil Nadu", "India", 11.02, 76.96, "Asia/Kolkata"],
    [8.2, 22, 14, 44, 6, 290],
    [46, 24, 0.16],
  ),
  createSeed(
    ["mumbai", "Mumbai", "Maharashtra", "India", 19.08, 72.88, "Asia/Kolkata"],
    [32, 76, 48, 56, 15, 840],
    [94, 49, 0.22],
  ),
  createSeed(
    ["london", "London", "Greater London", "United Kingdom", 51.51, -0.13, "Europe/London"],
    [16.5, 34, 44, 52, 7, 410],
    [65, 36, 0.2],
  ),
  createSeed(
    ["beijing", "Beijing", "Beijing", "China", 39.9, 116.41, "Asia/Shanghai"],
    [94, 172, 78, 34, 21, 1850],
    [174, 89, 0.3],
  ),
];

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
  if (!normalized) return getDemoCityLocations();
  return DEMO_CITY_SEEDS.filter(
    (seed) =>
      seed.location.name.toLowerCase().includes(normalized) ||
      seed.location.country.toLowerCase().includes(normalized) ||
      seed.location.region.toLowerCase().includes(normalized),
  ).map((seed) => seed.location);
}

function findClosestDemoSeed(cityKeyOrLocation: string | CityLocation): DemoCitySeed {
  const fallbackSeed = DEMO_CITY_SEEDS[0];
  if (!fallbackSeed) throw new Error("DEMO_CITY_SEEDS must contain at least one city.");
  if (typeof cityKeyOrLocation === "string") return fallbackSeed;

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

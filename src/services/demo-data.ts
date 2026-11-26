import type {
  AirQualityReport,
  CityLocation,
  DailyTrendPoint,
  HourlyForecastPoint,
  PollutantReadings,
} from "@/domain/types";
import { FORECAST_HOURS_WINDOW, TREND_DAYS_WINDOW } from "@/lib/constants";

interface DemoCitySeed {
  readonly location: CityLocation;
  readonly baseReadings: PollutantReadings;
  readonly baseUsAqi: number;
  readonly baseEuropeanAqi: number;
  readonly diurnalAmplitude: number;
}

const DEMO_REFERENCE_START_ISO = "2026-11-26T00:00:00Z";

const DEMO_CITY_SEEDS: readonly DemoCitySeed[] = [
  {
    location: {
      key: "delhi",
      name: "Delhi",
      region: "Delhi",
      country: "India",
      latitude: 28.61,
      longitude: 77.21,
      timezone: "Asia/Kolkata",
    },
    baseReadings: { pm25: 158, pm10: 278, no2: 92, o3: 38, so2: 24, co: 2450 },
    baseUsAqi: 224,
    baseEuropeanAqi: 108,
    diurnalAmplitude: 0.34,
  },
  {
    location: {
      key: "coimbatore",
      name: "Coimbatore",
      region: "Tamil Nadu",
      country: "India",
      latitude: 11.02,
      longitude: 76.96,
      timezone: "Asia/Kolkata",
    },
    baseReadings: { pm25: 8.2, pm10: 22, no2: 14, o3: 44, so2: 6, co: 290 },
    baseUsAqi: 46,
    baseEuropeanAqi: 24,
    diurnalAmplitude: 0.16,
  },
  {
    location: {
      key: "mumbai",
      name: "Mumbai",
      region: "Maharashtra",
      country: "India",
      latitude: 19.08,
      longitude: 72.88,
      timezone: "Asia/Kolkata",
    },
    baseReadings: { pm25: 32, pm10: 76, no2: 48, o3: 56, so2: 15, co: 840 },
    baseUsAqi: 94,
    baseEuropeanAqi: 49,
    diurnalAmplitude: 0.22,
  },
  {
    location: {
      key: "london",
      name: "London",
      region: "Greater London",
      country: "United Kingdom",
      latitude: 51.51,
      longitude: -0.13,
      timezone: "Europe/London",
    },
    baseReadings: { pm25: 16.5, pm10: 34, no2: 44, o3: 52, so2: 7, co: 410 },
    baseUsAqi: 65,
    baseEuropeanAqi: 36,
    diurnalAmplitude: 0.2,
  },
  {
    location: {
      key: "beijing",
      name: "Beijing",
      region: "Beijing",
      country: "China",
      latitude: 39.9,
      longitude: 116.41,
      timezone: "Asia/Shanghai",
    },
    baseReadings: { pm25: 94, pm10: 172, no2: 78, o3: 34, so2: 21, co: 1850 },
    baseUsAqi: 174,
    baseEuropeanAqi: 89,
    diurnalAmplitude: 0.3,
  },
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

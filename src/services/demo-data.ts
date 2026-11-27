// ============================================================================
// src/services/demo-data.ts
// Provides offline-ready seeded Demo Mode cities and diurnal forecast series.
// ============================================================================

import { FORECAST_HOURS_WINDOW, ISO_SLICE, TREND_DAYS_WINDOW } from "@/lib/constants";
import type {
  AirQualityReport,
  CityLocation,
  DailyTrendPoint,
  HourlyForecastPoint,
  PollutantReadings,
} from "@/types/air-quality";

type DayWeights = Record<number, number>;
const DAY_WEIGHTS: DayWeights = { 0: 1.0, 1: 0.94, 2: 0.88, 3: 0.96, 4: 1.05, 5: 0.9, 6: 0.84 };
const CFG = {
  startIso: "2026-11-26T00:00:00Z",
  updatedIso: "2026-11-26T08:00:00Z",
  msHour: 3_600_000,
  msDay: 86_400_000,
  hoursDay: 24,
  cleanPeak: 15,
  half: 0.5,
  o3Start: 12,
  o3End: 17,
  o3Boost: 1.25,
  o3Off: 0.85,
  minUs: 12,
  minEu: 8,
  pmScale: 10,
  minAvg: 15,
  minLow: 10,
  maxSpread: 0.45,
  minSpread: 0.75,
} as const;

type DemoCitySeed = (typeof DEMO_CITY_SEEDS)[number];
const DEMO_CITY_SEEDS: readonly {
  readonly location: CityLocation;
  readonly baseReadings: PollutantReadings;
  readonly baseUsAqi: number;
  readonly baseEuropeanAqi: number;
  readonly diurnalAmplitude: number;
}[] = [
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

const roundPm = (val: number) => Math.round(val * CFG.pmScale) / CFG.pmScale;

function buildHourlyPoint(seed: DemoCitySeed, baseMs: number, offset: number): HourlyForecastPoint {
  const dt = new Date(baseMs + offset * CFG.msHour);
  const hr = dt.getUTCHours();
  const angle = ((hr - CFG.cleanPeak) / CFG.hoursDay) * Math.PI * 2;
  const factor = 1 - seed.diurnalAmplitude * (CFG.half + CFG.half * Math.cos(angle));
  const o3m = hr >= CFG.o3Start && hr <= CFG.o3End ? CFG.o3Boost : CFG.o3Off;
  return {
    timeIso: dt.toISOString(),
    usAqi: Math.max(CFG.minUs, Math.round(seed.baseUsAqi * factor)),
    europeanAqi: Math.max(CFG.minEu, Math.round(seed.baseEuropeanAqi * factor)),
    pm25: roundPm(seed.baseReadings.pm25 * factor),
    pm10: Math.round(seed.baseReadings.pm10 * factor),
    no2: Math.round(seed.baseReadings.no2 * factor),
    o3: Math.round(seed.baseReadings.o3 * o3m),
  };
}

function buildDailyPoint(seed: DemoCitySeed, baseMs: number, day: number): DailyTrendPoint {
  const mult = DAY_WEIGHTS[day] ?? 1.0;
  const avg = Math.max(CFG.minAvg, Math.round(seed.baseUsAqi * mult));
  return {
    dateIso: new Date(baseMs + day * CFG.msDay).toISOString().slice(0, ISO_SLICE.dateEnd),
    avgUsAqi: avg,
    maxUsAqi: Math.round(avg * (1 + seed.diurnalAmplitude * CFG.maxSpread)),
    minUsAqi: Math.max(CFG.minLow, Math.round(avg * (1 - seed.diurnalAmplitude * CFG.minSpread))),
    avgPm25: roundPm(seed.baseReadings.pm25 * mult),
  };
}

/** Lists all five built-in Demo Mode city locations. */
export function getDemoCityLocations(): readonly CityLocation[] {
  return DEMO_CITY_SEEDS.map((seed) => seed.location);
}

/** Searches built-in Demo Mode cities matching a query string. */
export function searchDemoCities(query: string): readonly CityLocation[] {
  const q = query.trim().toLowerCase();
  if (!q) return getDemoCityLocations();
  return DEMO_CITY_SEEDS.filter(({ location: l }) =>
    [l.name, l.country, l.region].some((f) => f.toLowerCase().includes(q)),
  ).map((s) => s.location);
}

function findClosestSeed(target: string | CityLocation): DemoCitySeed {
  const first = DEMO_CITY_SEEDS[0];
  if (!first) throw new Error("DEMO_CITY_SEEDS must contain at least one city.");
  if (typeof target === "string") return first;
  const dist = (a: CityLocation) =>
    (a.latitude - target.latitude) ** 2 + (a.longitude - target.longitude) ** 2;
  return DEMO_CITY_SEEDS.reduce((b, c) => (dist(c.location) < dist(b.location) ? c : b), first);
}

/** Returns a seeded realistic AirQualityReport for a Demo Mode city key or location. */
export function getDemoAirQualityReport(cityKeyOrLoc: string | CityLocation): AirQualityReport {
  const key = (typeof cityKeyOrLoc === "string" ? cityKeyOrLoc : cityKeyOrLoc.key).toLowerCase();
  const seed = DEMO_CITY_SEEDS.find((s) => s.location.key === key) ?? findClosestSeed(cityKeyOrLoc);
  const baseMs = Date.parse(CFG.startIso);
  return {
    location: typeof cityKeyOrLoc === "string" ? seed.location : cityKeyOrLoc,
    updatedAtIso: CFG.updatedIso,
    source: "demo",
    current: {
      usAqi: seed.baseUsAqi,
      europeanAqi: seed.baseEuropeanAqi,
      readings: seed.baseReadings,
    },
    hourly: Array.from({ length: FORECAST_HOURS_WINDOW }, (_, i) =>
      buildHourlyPoint(seed, baseMs, i),
    ),
    daily: Array.from({ length: TREND_DAYS_WINDOW }, (_, d) => buildDailyPoint(seed, baseMs, d)),
  };
}

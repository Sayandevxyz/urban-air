import type { CityLocation, PollutantReadings } from "@/types/air-quality";

export interface DemoCitySeed {
  readonly location: CityLocation;
  readonly baseReadings: PollutantReadings;
  readonly baseUsAqi: number;
  readonly baseEuropeanAqi: number;
  readonly diurnalAmplitude: number;
}

export const DEMO_REFERENCE_START_ISO = "2026-11-26T00:00:00Z";

export const DEMO_CITY_SEEDS: readonly DemoCitySeed[] = [
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

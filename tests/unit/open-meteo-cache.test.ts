// ============================================================================
// tests/unit/open-meteo-cache.test.ts
// Tests SWR in-memory cache semantics and Open-Meteo contract mapping schemas.
// ============================================================================

import { expect, test, vi } from "vitest";
import { SwrMemoryCache } from "@/services/cache";
import {
  mapOpenMeteoLocations,
  mapOpenMeteoReport,
  openMeteoCurrentSchema,
  openMeteoGeocodeSchema,
  openMeteoHourlySchema,
} from "@/services/open-meteo-mapper";
import type { CityLocation } from "@/types/air-quality";

test("SwrMemoryCache handles fresh TTL, dedupe, SWR revalidation, and eviction", async () => {
  let now = 1_000;
  let version = 1;
  const cache = new SwrMemoryCache<string>({ maxEntries: 2, now: () => now });
  const fetcher = vi.fn(async () => {
    await Promise.resolve();
    return `v${version}`;
  });
  const policy = { ttlMs: 10_000, staleTtlMs: 30_000 };

  const [a, b] = await Promise.all([
    cache.getOrFetch("k1", policy, fetcher),
    cache.getOrFetch("k1", policy, fetcher),
  ]);
  expect([a, b]).toEqual(["v1", "v1"]);
  expect(fetcher).toHaveBeenCalledTimes(1);

  now = 15_000;
  version = 2;
  expect(await cache.getOrFetch("k1", policy, fetcher)).toBe("v1");
  await vi.waitFor(() => {
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  expect(await cache.getOrFetch("k1", policy, fetcher)).toBe("v2");

  await cache.getOrFetch("k2", policy, () => Promise.resolve("A"));
  await cache.getOrFetch("k3", policy, () => Promise.resolve("B"));
  expect(cache.size()).toBe(2);
  cache.clear();
  expect(cache.size()).toBe(0);
});

test("SwrMemoryCache skips disallowed writes and absorbs background revalidation errors", async () => {
  let now = 1_000;
  const boolCache = new SwrMemoryCache<{ ok: boolean }>({ maxEntries: 2, now: () => now });
  const errFetcher = vi.fn(() => Promise.resolve({ ok: false }));
  const policy = { ttlMs: 1_000, staleTtlMs: 5_000 };
  await boolCache.getOrFetch("err", policy, errFetcher, (val) => val.ok);
  await boolCache.getOrFetch("err", policy, errFetcher, (val) => val.ok);
  expect(errFetcher).toHaveBeenCalledTimes(2);

  const cache = new SwrMemoryCache<string>({ maxEntries: 2, now: () => now });
  await cache.getOrFetch("bg", policy, () => Promise.resolve("ok"));
  now += 7_000;
  await cache.getOrFetch("bg", policy, () => Promise.resolve("ok2"));
  now += 2_000;
  let rejectBg!: (err: Error) => void;
  const bgFetcher = vi.fn(
    () =>
      new Promise<string>((_r, rej) => {
        rejectBg = rej;
      }),
  );
  expect(await cache.getOrFetch("bg", policy, bgFetcher)).toBe("ok2");
  expect(await cache.getOrFetch("bg", policy, bgFetcher)).toBe("ok2");
  expect(bgFetcher).toHaveBeenCalledTimes(1);
  rejectBg(new Error("bg fail"));
  await Promise.resolve();
});

test("Open-Meteo geocoding schema maps empty, named, and fallback symbol entries", () => {
  expect(mapOpenMeteoLocations(openMeteoGeocodeSchema.parse({}))).toEqual([]);
  const fixture = openMeteoGeocodeSchema.parse({
    results: [
      {
        id: 1273294,
        name: "New Delhi",
        latitude: 28.613895,
        longitude: 77.209005,
        country: "India",
        admin1: "Delhi",
        timezone: "Asia/Kolkata",
      },
      { name: "---", latitude: 11.0168, longitude: 76.9558 },
    ],
  });
  const locations = mapOpenMeteoLocations(fixture);
  expect(locations[0]?.key).toBe("new-delhi-286-772");
  expect(locations[0]?.latitude).toBe(28.61);
  expect(locations[1]?.key).toMatch(/^loc-/);
});

const SAMPLE_CITY: CityLocation = {
  key: "delhi",
  name: "Delhi",
  region: "Delhi",
  country: "India",
  latitude: 28.61,
  longitude: 77.21,
  timezone: "Asia/Kolkata",
};

const buildSampleHours = (count: number): string[] =>
  Array.from(
    { length: count },
    (_, idx) =>
      `2026-11-${String(25 + Math.floor(idx / 24)).padStart(2, "0")}T${String(idx % 24).padStart(2, "0")}:00`,
  );

test("Open-Meteo report mapper aggregates 48h series, 7-day rollups, and sparse arrays", () => {
  const currentParsed = openMeteoCurrentSchema.parse({
    current: {
      time: "2026-11-26T08:00",
      us_aqi: 224,
      european_aqi: 108,
      pm2_5: 158.4,
      pm10: 278.1,
      nitrogen_dioxide: 92.3,
      ozone: 38,
      sulphur_dioxide: 24.1,
      carbon_monoxide: 2450,
    },
  });
  const hours = buildSampleHours(60);
  const hourlyParsed = openMeteoHourlySchema.parse({
    hourly: {
      time: hours,
      us_aqi: hours.map((_, idx) => 240 - idx * 2),
      european_aqi: hours.map(() => null),
      pm2_5: hours.map((_, idx) => Math.max(12, 160 - idx * 2)),
      pm10: hours.map(() => 180),
      nitrogen_dioxide: hours.map(() => 65),
      ozone: hours.map(() => 42),
    },
  });
  const report = mapOpenMeteoReport(SAMPLE_CITY, currentParsed, hourlyParsed);
  expect(report.hourly).toHaveLength(48);
  expect(report.daily[0]?.minUsAqi).toBeLessThanOrEqual(report.daily[0]?.maxUsAqi ?? 0);
  const emptyHourly = openMeteoHourlySchema.parse({ hourly: { time: [] } });
  expect(mapOpenMeteoReport(SAMPLE_CITY, currentParsed, emptyHourly).daily).toEqual([]);
});

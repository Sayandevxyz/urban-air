import { describe, expect, it } from "vitest";
import {
  mapOpenMeteoLocations,
  mapOpenMeteoReport,
  openMeteoCurrentSchema,
  openMeteoGeocodeSchema,
  openMeteoHourlySchema,
} from "@/services/openMeteoMapper";
import type { CityLocation } from "@/types/air-quality";

describe("Open-Meteo upstream payload contracts", () => {
  it("validates and maps full and sparse Open-Meteo geocoding payloads", () => {
    const emptyParsed = openMeteoGeocodeSchema.parse({});
    expect(mapOpenMeteoLocations(emptyParsed)).toEqual([]);

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
        {
          name: "---",
          latitude: 11.0168,
          longitude: 76.9558,
        },
      ],
    });

    const locations = mapOpenMeteoLocations(fixture);
    expect(locations).toHaveLength(2);
    expect(locations[0]?.key).toBe("new-delhi-286-772");
    expect(locations[0]?.latitude).toBe(28.61);
    expect(locations[1]?.key).toMatch(/^loc-/);
    expect(locations[1]?.timezone).toBe("UTC");
  });

  it("validates and maps current + multi-day hourly Open-Meteo air quality fixtures", () => {
    const city: CityLocation = {
      key: "delhi",
      name: "Delhi",
      region: "Delhi",
      country: "India",
      latitude: 28.61,
      longitude: 77.21,
      timezone: "Asia/Kolkata",
    };

    const currentParsed = openMeteoCurrentSchema.parse({
      current: {
        time: "2026-11-26T08:00",
        us_aqi: 224,
        european_aqi: 108,
        pm2_5: 158.4,
        pm10: 278.1,
        nitrogen_dioxide: 92.3,
        ozone: 38.0,
        sulphur_dioxide: 24.1,
        carbon_monoxide: 2450,
      },
    });

    const hours = Array.from({ length: 60 }, (_, idx) => {
      const day = 25 + Math.floor(idx / 24);
      const hr = idx % 24;
      return `2026-11-${String(day).padStart(2, "0")}T${String(hr).padStart(2, "0")}:00`;
    });

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

    const report = mapOpenMeteoReport(city, currentParsed, hourlyParsed);
    expect(report.source).toBe("open-meteo");
    expect(report.hourly).toHaveLength(48);
    expect(report.daily.length).toBeGreaterThanOrEqual(2);
    expect(report.daily[0]?.minUsAqi).toBeLessThanOrEqual(report.daily[0]?.maxUsAqi ?? 0);

    const emptyReport = mapOpenMeteoReport(
      city,
      currentParsed,
      openMeteoHourlySchema.parse({ hourly: { time: [] } }),
    );
    expect(emptyReport.daily).toEqual([]);
    expect(emptyReport.hourly).toEqual([]);
  });
});

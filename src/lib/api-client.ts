// ============================================================================
// src/lib/api-client.ts
// Executes typed client API fetches, runtime validation, and AQI queries.
// ============================================================================

import { DEFAULT_RETRY_AFTER_SECONDS, HTTP_STATUS } from "@/lib/constants";
import { safeJsonParse, toArr, toMap, toNum, toStr } from "@/lib/errors";
import { getDemoAirQualityReport } from "@/services/demo-data";
import type { AirQualityReport, CityLocation } from "@/types/air-quality";
import type { ApiFetchResult, ApiRequestOptions } from "@/types/api";

const SNAPSHOT_STORAGE_KEY = "urban-air:last-snapshot:v1";
type ReportSrc = AirQualityReport["source"];
const SOURCES = new Map<unknown, ReportSrc>([
  ["demo", "demo"],
  ["cached", "cached"],
]);
const s = (m: ReadonlyMap<string, unknown>, k: string) => toStr(m.get(k));
const n = (m: ReadonlyMap<string, unknown>, k: string) => toNum(m.get(k));

function parseCityLocation(raw: unknown): CityLocation {
  const m = toMap(raw);
  return {
    key: s(m, "key"),
    name: s(m, "name"),
    region: s(m, "region"),
    country: s(m, "country"),
    latitude: n(m, "latitude"),
    longitude: n(m, "longitude"),
    timezone: s(m, "timezone"),
  };
}

function parseForecastSeries(m: ReadonlyMap<string, unknown>) {
  return {
    hourly: toArr(m.get("hourly")).map((p) => {
      const hm = toMap(p);
      return {
        timeIso: s(hm, "timeIso"),
        usAqi: n(hm, "usAqi"),
        europeanAqi: n(hm, "europeanAqi"),
        pm25: n(hm, "pm25"),
        pm10: n(hm, "pm10"),
        no2: n(hm, "no2"),
        o3: n(hm, "o3"),
      };
    }),
    daily: toArr(m.get("daily")).map((d) => {
      const dm = toMap(d);
      return {
        dateIso: s(dm, "dateIso"),
        avgUsAqi: n(dm, "avgUsAqi"),
        maxUsAqi: n(dm, "maxUsAqi"),
        minUsAqi: n(dm, "minUsAqi"),
        avgPm25: n(dm, "avgPm25"),
      };
    }),
  };
}

function parseAirQualityReport(raw: unknown): AirQualityReport | null {
  try {
    const m = toMap(raw);
    const cur = toMap(m.get("current"));
    const rd = toMap(cur.get("readings"));
    return {
      location: parseCityLocation(m.get("location")),
      updatedAtIso: s(m, "updatedAtIso"),
      source: SOURCES.get(m.get("source")) ?? "open-meteo",
      current: {
        usAqi: n(cur, "usAqi"),
        europeanAqi: n(cur, "europeanAqi"),
        readings: {
          pm25: n(rd, "pm25"),
          pm10: n(rd, "pm10"),
          no2: n(rd, "no2"),
          o3: n(rd, "o3"),
          so2: n(rd, "so2"),
          co: n(rd, "co"),
        },
      },
      ...parseForecastSeries(m),
    };
  } catch {
    return null;
  }
}

/** Validates /api/geocode JSON payloads into typed location arrays cleanly. */
export function parseGeocodePayload(
  raw: unknown,
): { readonly results?: readonly CityLocation[] } | null {
  try {
    const resultsRaw = toMap(raw).get("results");
    return resultsRaw === undefined ? {} : { results: toArr(resultsRaw).map(parseCityLocation) };
  } catch {
    return null;
  }
}

function parseAirQualityEnvelope(raw: unknown): { readonly report?: AirQualityReport } | null {
  try {
    const reportRaw = toMap(raw).get("report");
    if (reportRaw === undefined) return {};
    const parsed = parseAirQualityReport(reportRaw);
    return parsed ? { report: parsed } : null;
  } catch {
    return null;
  }
}

function extractRetryAfterSeconds(body: unknown): number {
  try {
    const val = toNum(toMap(toMap(body).get("error")).get("retryAfterSeconds"));
    return val > 0 ? val : DEFAULT_RETRY_AFTER_SECONDS;
  } catch {
    return DEFAULT_RETRY_AFTER_SECONDS;
  }
}

function buildRequestInit(opts?: ApiRequestOptions): RequestInit {
  if (!opts) return { method: "GET" };
  const { method = "GET", headers, body, signal } = opts;
  return {
    method,
    ...(headers ? { headers } : {}),
    ...(body !== undefined ? { body } : {}),
    ...(signal ? { signal } : {}),
  };
}

function mapResponseResult<T>(
  res: Response,
  rawText: string,
  parse: (v: unknown) => T | null,
): ApiFetchResult<T> {
  const parsed = safeJsonParse(rawText);
  const body = parsed.ok ? parsed.value : undefined;
  if (res.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
    return { ok: false, kind: "rate_limited", retryAfterSeconds: extractRetryAfterSeconds(body) };
  }
  const validated = res.ok && body !== undefined ? parse(body) : null;
  return validated === null
    ? { ok: false, kind: "error", status: res.status }
    : { ok: true, data: validated };
}

/** Shared client fetch helper with runtime payload parsing, AbortError handling, and 429 cooldown. */
export async function fetchApiJson<T>(
  url: string,
  parse: (value: unknown) => T | null,
  options?: ApiRequestOptions,
): Promise<ApiFetchResult<T>> {
  try {
    const response = await fetch(url, buildRequestInit(options));
    return mapResponseResult(response, await response.text(), parse);
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError")
      return { ok: false, kind: "aborted" };
    return { ok: false, kind: "error", status: 0 };
  }
}

/** Reads the last non-geolocation cached report snapshot for offline resilience. */
export function readCachedSnapshot(): AirQualityReport | null {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    const parsed = raw ? safeJsonParse(raw) : null;
    const report = parsed?.ok ? parseAirQualityReport(parsed.value) : null;
    return report ? { ...report, source: "cached" } : null;
  } catch {
    return null;
  }
}

/** Fetches air quality telemetry for a location from Demo Mode or live /api/air-quality. */
export async function fetchAirQuality(
  loc: CityLocation,
  demoMode: boolean,
  signal?: AbortSignal,
): Promise<ApiFetchResult<AirQualityReport>> {
  if (demoMode) return { ok: true, data: getDemoAirQualityReport(loc) };
  const { key, latitude: lat, longitude: lon, ...meta } = loc;
  const p = new URLSearchParams({ ...meta, lat: `${lat}`, lon: `${lon}`, demo: "false" });
  if (!key.startsWith("geo-self-") && !key.startsWith("loc-")) p.set("cityKey", key);
  const res = await fetchApiJson(`/api/air-quality?${p.toString()}`, parseAirQualityEnvelope, {
    signal,
  });
  if (!res.ok) return res;
  if (!res.data.report) return { ok: false, kind: "error", status: HTTP_STATUS.BAD_GATEWAY };
  if (!res.data.report.location.key.startsWith("geo-self-")) {
    try {
      window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(res.data.report));
    } catch {
      /* storage quota */
    }
  }
  return { ok: true, data: res.data.report };
}

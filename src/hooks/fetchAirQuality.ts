import type { AirQualityReport, CityLocation } from "@/domain/types";
import { fetchApiJson, type ApiFetchResult } from "@/hooks/apiClient";
import { safeJsonParse } from "@/lib/json";
import { getDemoAirQualityReport } from "@/services/demo-data";

const SNAPSHOT_STORAGE_KEY = "urban-air:last-snapshot:v1";

interface AirQualityApiResponse {
  readonly report?: AirQualityReport;
}

/**
 * Builds the query string parameters for /api/air-quality from a CityLocation.
 */
function buildAirQualityQueryParams(location: CityLocation, demoMode: boolean): URLSearchParams {
  const params = new URLSearchParams({
    lat: String(location.latitude),
    lon: String(location.longitude),
    name: location.name,
    region: location.region,
    country: location.country,
    timezone: location.timezone,
    demo: demoMode ? "true" : "false",
  });
  if (!location.key.startsWith("geo-self-") && !location.key.startsWith("loc-")) {
    params.set("cityKey", location.key);
  }
  return params;
}

/**
 * Reads the last non-geolocation cached report snapshot for offline resilience.
 */
export function readCachedSnapshot(): AirQualityReport | null {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = safeJsonParse(raw);
    if (!parsed.ok || typeof parsed.value !== "object" || parsed.value === null) return null;
    const candidate = parsed.value as Partial<AirQualityReport>;
    if (typeof candidate.updatedAtIso === "string" && candidate.location?.name) {
      return { ...(candidate as AirQualityReport), source: "cached" };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persists a named city snapshot to localStorage while omitting transient device coordinates.
 */
function saveCachedSnapshot(report: AirQualityReport): void {
  try {
    if (report.location.key.startsWith("geo-self-")) return;
    window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(report));
  } catch {
    // Ignore storage quota restrictions.
  }
}

/**
 * Fetches air quality telemetry for a location from Demo Mode or live /api/air-quality.
 */
export async function fetchAirQuality(
  location: CityLocation,
  demoMode: boolean,
  signal?: AbortSignal,
): Promise<ApiFetchResult<AirQualityReport>> {
  if (demoMode) {
    return { ok: true, data: getDemoAirQualityReport(location) };
  }
  const params = buildAirQualityQueryParams(location, false);
  const res = await fetchApiJson<AirQualityApiResponse>(`/api/air-quality?${params.toString()}`, {
    signal,
  });
  if (!res.ok) return res;
  if (!res.data.report) {
    return { ok: false, kind: "error", status: 502 };
  }
  saveCachedSnapshot(res.data.report);
  return { ok: true, data: res.data.report };
}

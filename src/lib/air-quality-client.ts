import { fetchApiJson } from "@/lib/api-client";
import { safeJsonParse } from "@/lib/errors";
import { getDemoAirQualityReport } from "@/services/demo-data";
import type { AirQualityReport, CityLocation } from "@/types/air-quality";
import type { ApiFetchResult } from "@/types/api";

const SNAPSHOT_STORAGE_KEY = "urban-air:last-snapshot:v1";

interface AirQualityApiResponse {
  readonly report?: AirQualityReport;
}

function buildAirQualityQueryParams(location: CityLocation): URLSearchParams {
  const params = new URLSearchParams({
    lat: String(location.latitude),
    lon: String(location.longitude),
    name: location.name,
    region: location.region,
    country: location.country,
    timezone: location.timezone,
    demo: "false",
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
  const params = buildAirQualityQueryParams(location);
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

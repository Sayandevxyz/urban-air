import type { NextResponse } from "next/server";
import { ok } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getAirQualityProvider, responseFromResult } from "@/services/container";
import { getDemoAirQualityReport } from "@/services/demo-data";
import {
  parseAirQualityParams,
  resolveTargetLocation,
  withApiHandler,
} from "@/services/route-helpers";

/**
 * Fetches live or demo air quality telemetry and 48h/7d forecasts for a validated city or coordinates.
 */
export const GET = withApiHandler("air-quality", async (request): Promise<NextResponse> => {
  const parsed = parseAirQualityParams(request);
  const location = resolveTargetLocation(parsed);
  if (parsed.demo === "true") {
    return responseFromResult(ok({ report: getDemoAirQualityReport(location) }));
  }

  logger.info("Air quality lookup", {
    cityKey: location.key,
    lat: location.latitude,
    lon: location.longitude,
  });

  const result = await getAirQualityProvider().fetchAirQuality(location, request.signal);
  if (!result.ok) {
    return responseFromResult(result);
  }
  const cacheHeader =
    parsed.cityKey === undefined
      ? "private, no-store"
      : "public, max-age=120, stale-while-revalidate=300";
  return responseFromResult(ok({ report: result.value }), cacheHeader);
});

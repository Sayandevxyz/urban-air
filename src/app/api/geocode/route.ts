import type { NextResponse } from "next/server";
import { ok } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getGeocodingProvider, responseFromResult } from "@/services/container";
import { searchDemoCities } from "@/services/demo-data";
import { parseGeocodeParams, withApiHandler } from "@/services/route-helpers";

/**
 * Handles city autocomplete queries via Demo Mode or Open-Meteo Geocoding API.
 */
export const GET = withApiHandler("geocode", async (request): Promise<NextResponse> => {
  const { q, demo } = parseGeocodeParams(request);
  if (demo === "true") {
    return responseFromResult(ok({ results: searchDemoCities(q), source: "demo" }));
  }

  logger.info("Geocode search", { queryLength: q.length });
  const result = await getGeocodingProvider().searchCities(q, request.signal);
  if (!result.ok) {
    return responseFromResult(result);
  }
  return responseFromResult(ok({ results: result.value, source: "open-meteo" }));
});

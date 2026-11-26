import type { NextRequest } from "next/server";
import { AppError, ok } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  errorResponse,
  getGeocodingProvider,
  getRateLimiter,
  responseFromResult,
} from "@/services/container";
import { searchDemoCities } from "@/services/demo-data";
import { enforceRateLimit } from "@/services/rate-limit";
import { geocodeQuerySchema } from "@/services/schemas";

/**
 * Handles city autocomplete queries via Demo Mode or Open-Meteo Geocoding API.
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    await enforceRateLimit(getRateLimiter(), request.headers, "geocode");

    const parsed = geocodeQuerySchema.safeParse({
      q: request.nextUrl.searchParams.get("q") ?? "",
      demo: request.nextUrl.searchParams.get("demo") ?? "false",
    });

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid city search query.";
      throw new AppError("VALIDATION_ERROR", msg, 400);
    }

    const { q, demo } = parsed.data;
    if (demo === "true") {
      return responseFromResult(ok({ results: searchDemoCities(q), source: "demo" }));
    }

    logger.info("Geocode search", { queryLength: q.length });
    const result = await getGeocodingProvider().searchCities(q, request.signal);
    if (!result.ok) {
      return responseFromResult(result);
    }
    return responseFromResult(
      ok({ results: result.value, source: "open-meteo" }),
      "public, max-age=300, stale-while-revalidate=3600",
    );
  } catch (error) {
    return errorResponse(error);
  }
}

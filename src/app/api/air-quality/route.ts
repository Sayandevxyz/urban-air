import type { NextRequest } from "next/server";
import type { CityLocation } from "@/domain/types";
import { AppError, ok } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  errorResponse,
  getAirQualityProvider,
  getRateLimiter,
  responseFromResult,
} from "@/services/container";
import { getDemoAirQualityReport, getDemoCityLocations } from "@/services/demo-data";
import { enforceRateLimit } from "@/services/rate-limit";
import { airQualityQuerySchema } from "@/services/schemas";

function resolveTargetLocation(parsed: {
  cityKey?: string | undefined;
  lat?: number | undefined;
  lon?: number | undefined;
  name?: string | undefined;
  region?: string | undefined;
  country?: string | undefined;
  timezone?: string | undefined;
}): CityLocation {
  const demoCities = getDemoCityLocations();
  if (parsed.cityKey) {
    const matched = demoCities.find((city) => city.key === parsed.cityKey?.toLowerCase());
    if (matched) {
      return matched;
    }
    if (parsed.lat === undefined || parsed.lon === undefined) {
      throw new AppError("NOT_FOUND", `Unknown city key "${parsed.cityKey}".`, 404);
    }
  }

  const latitude = parsed.lat ?? 28.61;
  const longitude = parsed.lon ?? 77.21;
  return {
    key: parsed.cityKey ?? `loc-${Math.round(latitude * 100)}-${Math.round(longitude * 100)}`,
    name: parsed.name ?? "Your Location",
    region: parsed.region ?? "",
    country: parsed.country ?? "",
    latitude,
    longitude,
    timezone: parsed.timezone ?? "auto",
  };
}

/**
 * Fetches live or demo air quality telemetry and 48h/7d forecasts for a validated city or coordinates.
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    await enforceRateLimit(getRateLimiter(), request.headers, "air-quality");

    const params = request.nextUrl.searchParams;
    const rawInput = {
      cityKey: params.get("cityKey") ?? undefined,
      lat: params.get("lat") ?? undefined,
      lon: params.get("lon") ?? undefined,
      name: params.get("name") ?? undefined,
      region: params.get("region") ?? undefined,
      country: params.get("country") ?? undefined,
      timezone: params.get("timezone") ?? undefined,
      demo: params.get("demo") ?? "false",
    };

    const parsed = airQualityQuerySchema.safeParse(rawInput);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid air quality request parameters.";
      throw new AppError("VALIDATION_ERROR", msg, 400);
    }

    const location = resolveTargetLocation(parsed.data);
    if (parsed.data.demo === "true") {
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

    const isCustomCoords = parsed.data.cityKey === undefined;
    return responseFromResult(
      ok({ report: result.value }),
      isCustomCoords ? "private, no-store" : "public, max-age=120, stale-while-revalidate=300",
    );
  } catch (error) {
    return errorResponse(error);
  }
}

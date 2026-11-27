// ============================================================================
// src/services/route-helpers.ts
// Wraps Next.js API route handlers with rate limiting, size checks, and Zod.
// ============================================================================

import type { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { COORDINATE_ROUND_FACTOR, DECIMAL_RADIX, HTTP_STATUS } from "@/lib/constants";
import { AppError, safeJsonParse } from "@/lib/errors";
import { errorResponse, getRateLimiter } from "@/services/container";
import { getDemoCityLocations } from "@/services/demo-data";
import { enforceRateLimit } from "@/services/rate-limit";
import { airQualityQuerySchema, geocodeQuerySchema } from "@/services/schemas";
import type { CityLocation } from "@/types/air-quality";

const DEFAULT_FALLBACK_LAT = 28.61;
const DEFAULT_FALLBACK_LON = 77.21;
const AIR_QUALITY_PARAM_KEYS = [
  "cityKey",
  "lat",
  "lon",
  "name",
  "region",
  "country",
  "timezone",
] as const;

/** Wraps an API route handler with consistent per-IP rate limiting and error responses. */
export function withApiHandler(
  routeKey: string,
  handler: (request: NextRequest) => Promise<NextResponse>,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      await enforceRateLimit(getRateLimiter(), request.headers, routeKey);
      return await handler(request);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

function assertRequestMetadata(request: NextRequest, maxBytes: number): void {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Content-Type must be application/json.",
      HTTP_STATUS.UNSUPPORTED_MEDIA,
    );
  }
  const lengthRaw = request.headers.get("content-length");
  if (lengthRaw !== null) {
    if (!/^\d+$/.test(lengthRaw.trim())) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Invalid Content-Length header.",
        HTTP_STATUS.BAD_REQUEST,
      );
    }
    if (Number.parseInt(lengthRaw, DECIMAL_RADIX) > maxBytes) {
      throw new AppError(
        "PAYLOAD_TOO_LARGE",
        "Request payload exceeds maximum allowed size.",
        HTTP_STATUS.PAYLOAD_TOO_LARGE,
      );
    }
  }
}

/** Validates Content-Type, Content-Length, actual byte limit, JSON syntax, and Zod schema. */
export async function parseJsonBody<T>(
  request: NextRequest,
  schema: z.ZodType<T>,
  maxBytes: number,
): Promise<T> {
  assertRequestMetadata(request, maxBytes);
  const rawText = await request.text();
  if (Buffer.byteLength(rawText, "utf8") > maxBytes) {
    throw new AppError(
      "PAYLOAD_TOO_LARGE",
      "Request payload exceeds maximum allowed size.",
      HTTP_STATUS.PAYLOAD_TOO_LARGE,
    );
  }
  const parsedJson = safeJsonParse(rawText);
  if (!parsedJson.ok) {
    throw new AppError("VALIDATION_ERROR", "Malformed JSON request body.", HTTP_STATUS.BAD_REQUEST);
  }
  const validated = schema.safeParse(parsedJson.value);
  if (!validated.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      validated.error.issues[0]?.message ?? "Invalid request payload.",
      HTTP_STATUS.BAD_REQUEST,
    );
  }
  return validated.data;
}

/** Validates GET /api/geocode query parameters via Zod or throws a typed 400 AppError. */
export function parseGeocodeParams(request: NextRequest): z.infer<typeof geocodeQuerySchema> {
  const parsed = geocodeQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
    demo: request.nextUrl.searchParams.get("demo") ?? "false",
  });
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid city search query.",
      HTTP_STATUS.BAD_REQUEST,
    );
  }
  return parsed.data;
}

/** Validates GET /api/air-quality query parameters via Zod or throws a typed 400 AppError. */
export function parseAirQualityParams(request: NextRequest): z.infer<typeof airQualityQuerySchema> {
  const params = request.nextUrl.searchParams;
  const rawInput: Record<string, string | undefined> = { demo: params.get("demo") ?? "false" };
  for (const key of AIR_QUALITY_PARAM_KEYS) {
    rawInput[key] = params.get(key) ?? undefined;
  }
  const parsed = airQualityQuerySchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid air quality request parameters.",
      HTTP_STATUS.BAD_REQUEST,
    );
  }
  return parsed.data;
}

function buildCustomLocation(parsed: z.infer<typeof airQualityQuerySchema>): CityLocation {
  const latitude = parsed.lat ?? DEFAULT_FALLBACK_LAT;
  const longitude = parsed.lon ?? DEFAULT_FALLBACK_LON;
  const latCode = Math.round(latitude * COORDINATE_ROUND_FACTOR);
  const lonCode = Math.round(longitude * COORDINATE_ROUND_FACTOR);
  return {
    key: parsed.cityKey ?? `loc-${latCode}-${lonCode}`,
    name: parsed.name ?? "Your Location",
    region: parsed.region ?? "",
    country: parsed.country ?? "",
    latitude,
    longitude,
    timezone: parsed.timezone ?? "auto",
  };
}

/** Resolves a preset cityKey or validated coordinates into a canonical CityLocation model. */
export function resolveTargetLocation(parsed: z.infer<typeof airQualityQuerySchema>): CityLocation {
  if (parsed.cityKey) {
    const targetKey = parsed.cityKey.toLowerCase();
    const matched = getDemoCityLocations().find((city) => city.key === targetKey);
    if (matched) return matched;
    if (parsed.lat === undefined || parsed.lon === undefined) {
      throw new AppError(
        "NOT_FOUND",
        `Unknown city key "${parsed.cityKey}".`,
        HTTP_STATUS.NOT_FOUND,
      );
    }
  }
  return buildCustomLocation(parsed);
}

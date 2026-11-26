import { NextResponse } from "next/server";
import { DAILY_LLM_WINDOW_MS } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { AppError, toSafeErrorResponse, type Result } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { OpenMeteoAirQualityProvider, OpenMeteoGeocodingProvider } from "@/services/open-meteo";
import { InMemoryTokenBucketRateLimiter, type RateLimiter } from "@/services/rate-limit";

let rateLimiterSingleton: InMemoryTokenBucketRateLimiter | undefined;
let dailyLlmLimiterSingleton: InMemoryTokenBucketRateLimiter | undefined;
let geocodingProviderSingleton: OpenMeteoGeocodingProvider | undefined;
let airQualityProviderSingleton: OpenMeteoAirQualityProvider | undefined;

/**
 * Returns the shared server rate limiter configured from validated environment variables.
 */
export function getRateLimiter(): RateLimiter {
  if (!rateLimiterSingleton) {
    const env = getEnv();
    rateLimiterSingleton = new InMemoryTokenBucketRateLimiter({
      maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
      windowMs: env.RATE_LIMIT_WINDOW_MS,
    });
  }
  return rateLimiterSingleton;
}

/**
 * Returns the shared daily per-IP limiter capping /api/chat LLM invocations over 24 hours.
 */
export function getDailyLlmRateLimiter(): RateLimiter {
  if (!dailyLlmLimiterSingleton) {
    const env = getEnv();
    dailyLlmLimiterSingleton = new InMemoryTokenBucketRateLimiter({
      maxRequests: env.DAILY_LLM_MAX_REQUESTS,
      windowMs: DAILY_LLM_WINDOW_MS,
    });
  }
  return dailyLlmLimiterSingleton;
}

/**
 * Resets the shared rate limiter state (intended for deterministic tests).
 */
export function resetRateLimiter(): void {
  rateLimiterSingleton?.reset();
  rateLimiterSingleton = undefined;
  dailyLlmLimiterSingleton?.reset();
  dailyLlmLimiterSingleton = undefined;
}

/**
 * Returns the active GeocodingProvider implementation.
 */
export function getGeocodingProvider(): OpenMeteoGeocodingProvider {
  if (!geocodingProviderSingleton) {
    geocodingProviderSingleton = new OpenMeteoGeocodingProvider();
  }
  return geocodingProviderSingleton;
}

/**
 * Returns the active AirQualityProvider implementation.
 */
export function getAirQualityProvider(): OpenMeteoAirQualityProvider {
  if (!airQualityProviderSingleton) {
    airQualityProviderSingleton = new OpenMeteoAirQualityProvider();
  }
  return airQualityProviderSingleton;
}

/**
 * Converts a service Result into a safe NextResponse with optional cache headers.
 */
export function responseFromResult<T>(result: Result<T>, cacheControl = "no-store"): NextResponse {
  if (result.ok) {
    return NextResponse.json(result.value, {
      status: 200,
      headers: { "Cache-Control": cacheControl },
    });
  }
  return errorResponse(result.error);
}

/**
 * Converts any thrown error or AppError into a safe JSON response with Retry-After on 429s.
 */
export function errorResponse(error: unknown): NextResponse {
  const safe = toSafeErrorResponse(error);
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (safe.statusCode === 429 && safe.body.error.retryAfterSeconds !== undefined) {
    headers["Retry-After"] = String(safe.body.error.retryAfterSeconds);
  }
  if (!(error instanceof AppError) || error.statusCode >= 500) {
    logger.error("API route error", {
      code: safe.body.error.code,
      statusCode: safe.statusCode,
    });
  }
  return NextResponse.json(safe.body, { status: safe.statusCode, headers });
}

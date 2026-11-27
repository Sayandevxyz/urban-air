// ============================================================================
// src/services/container.ts
// Wires rate-limiter singletons and standardized JSON response helpers.
// ============================================================================

import { NextResponse } from "next/server";
import { DAILY_LLM_WINDOW_MS, HTTP_STATUS } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { AppError, toSafeErrorResponse, type Result } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { InMemoryTokenBucketRateLimiter, type RateLimiter } from "@/services/rate-limit";

let rateLimiterSingleton: InMemoryTokenBucketRateLimiter | undefined;
let dailyLlmLimiterSingleton: InMemoryTokenBucketRateLimiter | undefined;

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
 * Converts a service Result into a safe NextResponse with optional cache headers.
 */
export function responseFromResult<T>(result: Result<T>, cacheControl = "no-store"): NextResponse {
  if (result.ok) {
    return NextResponse.json(result.value, {
      status: HTTP_STATUS.OK,
      headers: { "Cache-Control": cacheControl },
    });
  }
  return errorResponse(result.error);
}

/** Converts any thrown error or AppError into a safe JSON response with Retry-After on 429s. */
export function errorResponse(error: unknown): NextResponse {
  const safe = toSafeErrorResponse(error);
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (
    safe.statusCode === HTTP_STATUS.TOO_MANY_REQUESTS &&
    safe.body.error.retryAfterSeconds !== undefined
  ) {
    headers["Retry-After"] = String(safe.body.error.retryAfterSeconds);
  }
  if (!(error instanceof AppError) || error.statusCode >= HTTP_STATUS.INTERNAL_ERROR) {
    logger.error("API route error", {
      code: safe.body.error.code,
      statusCode: safe.statusCode,
    });
  }
  return NextResponse.json(safe.body, { status: safe.statusCode, headers });
}

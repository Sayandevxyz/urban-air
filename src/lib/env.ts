// ============================================================================
// src/lib/env.ts
// Validates startup server environment variables with Zod and SSRF allowlists.
// ============================================================================

import { z } from "zod";
import { ALLOWED_UPSTREAM_HOSTS, DAILY_LLM_MAX_REQUESTS, HTTP_STATUS } from "@/lib/constants";
import { AppError } from "@/lib/errors";

const API_KEY_MIN_LENGTH = 10;
const API_KEY_MAX_LENGTH = 256;
const MODEL_NAME_MIN_LENGTH = 3;
const MODEL_NAME_MAX_LENGTH = 80;
const MAX_RATE_REQUESTS = 10_000;
const DEFAULT_RATE_REQUESTS = 60;
const MIN_RATE_WINDOW_MS = 1_000;
const MAX_RATE_WINDOW_MS = 3_600_000;
const DEFAULT_RATE_WINDOW_MS = 60_000;

function isAllowlistedHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && ALLOWED_UPSTREAM_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_DEFAULT_DEMO_MODE: z.enum(["true", "false"]).default("false"),
  OPEN_METEO_AIR_QUALITY_BASE_URL: z
    .string()
    .refine(isAllowlistedHttpsUrl, {
      error: "OPEN_METEO_AIR_QUALITY_BASE_URL must use HTTPS on an allowlisted host.",
    })
    .default("https://air-quality-api.open-meteo.com/v1"),
  OPEN_METEO_GEOCODING_BASE_URL: z
    .string()
    .refine(isAllowlistedHttpsUrl, {
      error: "OPEN_METEO_GEOCODING_BASE_URL must use HTTPS on an allowlisted host.",
    })
    .default("https://geocoding-api.open-meteo.com/v1"),
  LLM_PROVIDER: z.enum(["auto", "gemini", "anthropic", "fallback"]).default("auto"),
  GEMINI_API_KEY: z.string().trim().min(API_KEY_MIN_LENGTH).max(API_KEY_MAX_LENGTH).optional(),
  GEMINI_MODEL: z
    .string()
    .trim()
    .min(MODEL_NAME_MIN_LENGTH)
    .max(MODEL_NAME_MAX_LENGTH)
    .default("gemini-2.5-flash"),
  ANTHROPIC_API_KEY: z.string().trim().min(API_KEY_MIN_LENGTH).max(API_KEY_MAX_LENGTH).optional(),
  ANTHROPIC_MODEL: z
    .string()
    .trim()
    .min(MODEL_NAME_MIN_LENGTH)
    .max(MODEL_NAME_MAX_LENGTH)
    .default("claude-3-5-haiku-latest"),
  RATE_LIMIT_MAX_REQUESTS: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_RATE_REQUESTS)
    .default(DEFAULT_RATE_REQUESTS),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(MIN_RATE_WINDOW_MS)
    .max(MAX_RATE_WINDOW_MS)
    .default(DEFAULT_RATE_WINDOW_MS),
  DAILY_LLM_MAX_REQUESTS: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_RATE_REQUESTS)
    .default(DAILY_LLM_MAX_REQUESTS),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).default("info"),
});

/** Validated runtime environment configuration. */
export type ValidatedEnv = z.infer<typeof envSchema>;

function emptyStringsToUndefined(
  raw: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("NEXT_PUBLIC_") && /key|secret|token|password/i.test(key) && value) {
      throw new AppError(
        "CONFIG_ERROR",
        `Forbidden secret exposure detected in client-exposed variable: ${key}`,
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
    normalized[key] = value === "" ? undefined : value;
  }
  return normalized;
}

/** Parses and validates environment variables once, failing fast with an AppError. */
export function parseEnv(rawEnv: Record<string, string | undefined>): ValidatedEnv {
  const normalized = emptyStringsToUndefined(rawEnv);
  const parsed = envSchema.safeParse(normalized);
  if (!parsed.success) {
    const issueSummary = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new AppError(
      "CONFIG_ERROR",
      `Invalid environment configuration: ${issueSummary}`,
      HTTP_STATUS.INTERNAL_ERROR,
    );
  }
  return parsed.data;
}

let cachedEnv: ValidatedEnv | undefined;

/** Returns memoized validated server environment configuration. */
export function getEnv(): ValidatedEnv {
  if (!cachedEnv) {
    cachedEnv = parseEnv(process.env);
  }
  return cachedEnv;
}

/** Clears the cached environment object (intended exclusively for deterministic tests). */
export function resetEnvCache(): void {
  cachedEnv = undefined;
}

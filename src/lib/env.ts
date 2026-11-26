import { z } from "zod";
import { ALLOWED_UPSTREAM_HOSTS } from "@/lib/constants";
import { AppError } from "@/lib/errors";

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
    .url()
    .refine(isAllowlistedHttpsUrl, {
      error: "OPEN_METEO_AIR_QUALITY_BASE_URL must use HTTPS on an allowlisted host.",
    })
    .default("https://air-quality-api.open-meteo.com/v1"),
  OPEN_METEO_GEOCODING_BASE_URL: z
    .url()
    .refine(isAllowlistedHttpsUrl, {
      error: "OPEN_METEO_GEOCODING_BASE_URL must use HTTPS on an allowlisted host.",
    })
    .default("https://geocoding-api.open-meteo.com/v1"),
  LLM_PROVIDER: z.enum(["auto", "gemini", "anthropic", "fallback"]).default("auto"),
  GEMINI_API_KEY: z.string().trim().min(10).max(256).optional(),
  GEMINI_MODEL: z.string().trim().min(3).max(80).default("gemini-2.5-flash"),
  ANTHROPIC_API_KEY: z.string().trim().min(10).max(256).optional(),
  ANTHROPIC_MODEL: z.string().trim().min(3).max(80).default("claude-3-5-haiku-latest"),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).max(10_000).default(60),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).max(3_600_000).default(60_000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).default("info"),
});

/**
 * Validated runtime environment configuration.
 */
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
        500,
      );
    }
    normalized[key] = value === "" ? undefined : value;
  }
  return normalized;
}

/**
 * Parses and validates environment variables once, failing fast with an actionable AppError.
 */
export function parseEnv(rawEnv: Record<string, string | undefined>): ValidatedEnv {
  const normalized = emptyStringsToUndefined(rawEnv);
  const parsed = envSchema.safeParse(normalized);
  if (!parsed.success) {
    const issueSummary = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new AppError("CONFIG_ERROR", `Invalid environment configuration: ${issueSummary}`, 500);
  }
  return parsed.data;
}

let cachedEnv: ValidatedEnv | undefined;

/**
 * Returns memoized validated server environment configuration.
 */
export function getEnv(): ValidatedEnv {
  if (!cachedEnv) {
    cachedEnv = parseEnv(process.env);
  }
  return cachedEnv;
}

/**
 * Clears the cached environment object (intended exclusively for deterministic tests).
 */
export function resetEnvCache(): void {
  cachedEnv = undefined;
}

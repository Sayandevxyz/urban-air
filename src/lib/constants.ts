/**
 * Named application constants with explicit units to avoid magic numbers across layers.
 */

export const AQI_CACHE_TTL_MS = 10 * 60 * 1000;
export const AQI_CACHE_STALE_TTL_MS = 30 * 60 * 1000;
export const GEOCODING_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const GEOCODING_CACHE_STALE_TTL_MS = 48 * 60 * 60 * 1000;
export const MAX_CACHE_ENTRIES = 250;

export const UPSTREAM_TIMEOUT_MS = 8_000;
export const LLM_TIMEOUT_MS = 15_000;
export const MAX_UPSTREAM_RESPONSE_BYTES = 1_048_576;

export const SEARCH_DEBOUNCE_MS = 300;
export const MAX_CITY_QUERY_LENGTH = 80;
export const MIN_CITY_QUERY_LENGTH = 2;
export const MAX_CHAT_MESSAGE_LENGTH = 500;
export const MAX_LLM_OUTPUT_TOKENS = 450;
export const MAX_COMPARE_CITIES = 3;

export const COORDINATE_LOG_DECIMALS = 2;
export const COORDINATE_CACHE_DECIMALS = 2;

export const ALLOWED_UPSTREAM_HOSTS: readonly string[] = [
  "air-quality-api.open-meteo.com",
  "geocoding-api.open-meteo.com",
  "generativelanguage.googleapis.com",
  "api.anthropic.com",
] as const;

export const SUPPORTED_LOCALES = ["en", "hi", "ta"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * WHO 2021 Air Quality Guideline 24-hour / 8-hour reference values in micrograms per cubic meter.
 */
export const WHO_GUIDELINES_2021_UG_M3 = {
  pm25: 15,
  pm10: 45,
  no2: 25,
  o3: 100,
  so2: 40,
  co: 4000,
} as const;

/**
 * Severe winter smog trigger thresholds (US EPA unhealthy particulate / inversion levels).
 */
export const WINTER_SMOG_THRESHOLDS = {
  usAqiSevere: 151,
  usAqiEmergency: 201,
  pm25SevereUgM3: 55.5,
  pm10SevereUgM3: 155,
  no2ElevatedUgM3: 80,
} as const;

export const FORECAST_HOURS_WINDOW = 48;
export const TREND_DAYS_WINDOW = 7;
export const PLANNER_HOURS_WINDOW = 24;

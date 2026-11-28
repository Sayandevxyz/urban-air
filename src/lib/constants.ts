// ============================================================================
// src/lib/constants.ts
// Centralizes domain, HTTP, security, cache, and UI boundary constants.
// ============================================================================

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const AQI_CACHE_MINUTES = 10;
const AQI_STALE_MINUTES = 30;
const GEOCODING_STALE_DAYS = 2;

/** Numbering radix used when parsing decimal integer headers and time tokens. */
export const DECIMAL_RADIX = 10;
/** Shared HTTP status codes enforced at route, SSRF, and upstream boundaries. */
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA: 415,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
  GATEWAY_TIMEOUT: 504,
} as const;
/** Canonical ISO-8601 substring slice offsets for timestamps (YYYY-MM-DDTHH:MM). */
export const ISO_SLICE = {
  dateEnd: 10,
  monthDayStart: 5,
  hourStart: 11,
  hourEnd: 13,
  minuteEnd: 16,
} as const;
/** Minimum inclusive US EPA AQI breakpoints triggering each severity tier. */
export const US_AQI_TIER_THRESHOLDS = {
  moderate: 51,
  sensitive: 101,
  unhealthy: 151,
  veryUnhealthy: 201,
} as const;
/** Upper numerical ceiling of the US EPA AQI reporting scale. */
export const MAX_US_AQI = 500;
/** Fresh TTL window (10 min) for cached city AQI reports. */
export const AQI_CACHE_TTL_MS = AQI_CACHE_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;
/** Stale-while-revalidate serving window (30 min) for city AQI reports. */
export const AQI_CACHE_STALE_TTL_MS = AQI_STALE_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;
/** Fresh TTL window (24 h) for geocoding lookups. */
export const GEOCODING_CACHE_TTL_MS =
  HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;
/** Stale-while-revalidate window (48 h) for geocoding lookups. */
export const GEOCODING_CACHE_STALE_TTL_MS = GEOCODING_STALE_DAYS * GEOCODING_CACHE_TTL_MS;
/** Maximum in-memory cache entry count to bound server heap usage. */
export const MAX_CACHE_ENTRIES = 250;
/** Hard timeout in milliseconds for Open-Meteo upstream HTTP calls. */
export const UPSTREAM_TIMEOUT_MS = 8_000;
/** Hard timeout in milliseconds for server-side LLM inference requests. */
export const LLM_TIMEOUT_MS = 15_000;
/** Maximum byte budget read from any upstream HTTP JSON response (1 MiB). */
export const MAX_UPSTREAM_RESPONSE_BYTES = 1_048_576;
/** Client keystroke debounce interval before dispatching city geocode requests. */
export const SEARCH_DEBOUNCE_MS = 300;
/** Maximum permitted character length for geocode city queries. */
export const MAX_CITY_QUERY_LENGTH = 80;
/** Minimum character count required before firing city autocomplete requests. */
export const MIN_CITY_QUERY_LENGTH = 2;
/** Maximum permitted character length for user chat questions. */
export const MAX_CHAT_MESSAGE_LENGTH = 500;
/** Pre-parse byte ceiling for POST /api/chat request bodies (16 KiB). */
export const MAX_CHAT_PAYLOAD_BYTES = 16_384;
/** Maximum completion tokens requested from upstream LLM APIs. */
export const MAX_LLM_OUTPUT_TOKENS = 450;
/** Hard character ceiling applied when sanitizing outbound assistant text. */
export const MAX_LLM_OUTPUT_CHARS = 1_400;
/** Maximum number of cities allowed in side-by-side comparison. */
export const MAX_COMPARE_CITIES = 3;
/** Minimum configurable local alert threshold value. */
export const ALERT_THRESHOLD_MIN = 10;
/** Maximum configurable local alert threshold value. */
export const ALERT_THRESHOLD_MAX = 500;
/** Default US AQI threshold seeded for new alert rules. */
export const ALERT_DEFAULT_THRESHOLD = 100;
/** Maximum daily round-trip commute distance supported by impact simulator (km). */
export const COMMUTE_MAX_KM = 150;
/** Default daily commute distance assumed by prompt estimates and simulator (km). */
export const COMMUTE_DEFAULT_KM = 10;
/** Maximum daily outdoor duration modeled by impact simulator (hours). */
export const OUTDOOR_MAX_HOURS = 12;
/** Default daily outdoor exposure hours modeled by impact simulator. */
export const OUTDOOR_DEFAULT_HOURS = 1.5;
/** Default client cooldown shown if a 429 response lacks Retry-After. */
export const DEFAULT_RETRY_AFTER_SECONDS = 30;
/** Default Retry-After fallback used when upstream omits the header. */
export const UPSTREAM_DEFAULT_RETRY_AFTER_SECONDS = 60;
/** Number of hourly forecast rows rendered in the accessible table view. */
export const HOURLY_PREVIEW_COUNT = 24;
/** Maximum browser geolocation acquisition timeout before graceful fallback. */
export const GEO_TIMEOUT_MS = 8_000;
/** Maximum age for cached browser geolocation fixes before refreshing. */
export const GEO_MAX_AGE_MS = 60_000;
/** Default Y-axis upper bound for hourly AQI charts when air is clean. */
export const DEFAULT_CHART_MAX_AQI = 100;
/** Vertical headroom added above peak forecast AQI for readable charts. */
export const CHART_HEADROOM_AQI = 20;
/** Decimal precision retained in logs (~1.1 km) to protect resident privacy. */
export const COORDINATE_LOG_DECIMALS = 2;
/** Decimal precision retained in SWR cache keys so nearby coords coalesce safely. */
export const COORDINATE_CACHE_DECIMALS = 2;
/** Multiplication factor matching 2-decimal rounding precision. */
export const COORDINATE_ROUND_FACTOR = 100;
/** Default daily per-IP cap protecting optional upstream LLM quotas. */
export const DAILY_LLM_MAX_REQUESTS = 50;
/** Rolling 24-hour window in milliseconds for daily LLM quota enforcement. */
export const DAILY_LLM_WINDOW_MS =
  HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;
/** Strict outbound HTTPS host allowlist preventing SSRF to internal networks. */
export const ALLOWED_UPSTREAM_HOSTS: readonly string[] = [
  "air-quality-api.open-meteo.com",
  "geocoding-api.open-meteo.com",
  "generativelanguage.googleapis.com",
  "api.anthropic.com",
] as const;
/** UI languages supported across client catalogs and grounded assistant replies. */
export const SUPPORTED_LOCALES = ["en", "hi", "ta"] as const;
/** Union type of supported UI language codes. */
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
/** WHO 2021 Air Quality Guideline 24h/8h reference values in micrograms per cubic meter. */
export const WHO_GUIDELINES_2021_UG_M3 = {
  pm25: 15,
  pm10: 45,
  no2: 25,
  o3: 100,
  so2: 40,
  co: 4000,
} as const;
/** Severe winter smog trigger thresholds aligned with US EPA particulate bands. */
export const WINTER_SMOG_THRESHOLDS = {
  usAqiSevere: 151,
  usAqiEmergency: 201,
  pm25SevereUgM3: 55.5,
  pm10SevereUgM3: 155,
  no2ElevatedUgM3: 80,
} as const;
/** Forecast horizon displayed in hourly view and computed by Open-Meteo mapper. */
export const FORECAST_HOURS_WINDOW = 48;
/** Multi-day trend horizon summarized into daily bars and table rows. */
export const TREND_DAYS_WINDOW = 7;
/** Default lookahead horizon evaluated by the activity window planner. */
export const PLANNER_HOURS_WINDOW = 24;
/** Semantic WCAG AA high-contrast surface classes keyed by tone variant. */
export const TONE_SURFACE_CLASSES = {
  emerald:
    "border-2 border-emerald-700 bg-emerald-50 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-100",
  amber:
    "border-2 border-amber-700 bg-amber-50 text-amber-950 dark:border-amber-400 dark:bg-amber-950/60 dark:text-amber-100",
  rose: "border-2 border-rose-700 bg-rose-50 text-rose-950 dark:border-rose-400 dark:bg-rose-950/60 dark:text-rose-100",
} as const;

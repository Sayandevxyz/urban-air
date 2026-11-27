// ============================================================================
// src/types/air-quality.ts
// Defines canonical telemetry, forecast, location, and AQI severity models.
// ============================================================================

/** Criteria air pollutant keys evaluated across ingestion, domain logic, and UI. */
export type PollutantKey = "pm25" | "pm10" | "no2" | "o3" | "so2" | "co";

/** Standard US EPA six-tier Air Quality Index category identifiers. */
export type AqiCategory =
  "good" | "moderate" | "sensitive" | "unhealthy" | "very_unhealthy" | "hazardous";

/** European Environment Agency six-tier EAQI index band identifiers. */
export type EuropeanAqiBand =
  "good" | "fair" | "moderate" | "poor" | "very_poor" | "extremely_poor";

type SmogSeverity = "none" | "elevated" | "severe_smog" | "smog_emergency";

/** Raw pollutant concentrations reported in micrograms per cubic meter (ug/m3). */
export interface PollutantReadings {
  readonly pm25: number;
  readonly pm10: number;
  readonly no2: number;
  readonly o3: number;
  readonly so2: number;
  readonly co: number;
}

/** Pollutant concentration evaluated against WHO 2021 guidelines and US AQI share. */
export interface PollutantAssessment {
  readonly key: PollutantKey;
  readonly valueUgM3: number;
  readonly whoGuidelineUgM3: number;
  readonly whoRatio: number;
  readonly exceedsWho: boolean;
  readonly subIndexUsAqi: number;
  readonly isDominant: boolean;
}

/** Accessible category metadata pairing semantic color token with icon and pattern. */
export interface UsAqiClassification {
  readonly category: AqiCategory;
  readonly severityRank: number;
  readonly iconId:
    "leaf" | "sun-cloud" | "shield-alert" | "mask-warning" | "smog-danger" | "biohazard";
  readonly patternId: "solid" | "dots" | "diagonal" | "crosshatch" | "grid" | "dense-bars";
  readonly tokenName: string;
}

/** Deterministic winter smog and urban temperature-inversion risk evaluation. */
export interface SmogAssessment {
  readonly severity: SmogSeverity;
  readonly isWinterSmogAlert: boolean;
  readonly inversionTrapLikely: boolean;
  readonly primaryDrivers: readonly PollutantKey[];
}

/** Single hourly air-quality forecast point across dual AQI scales and key pollutants. */
export interface HourlyForecastPoint {
  readonly timeIso: string;
  readonly usAqi: number;
  readonly europeanAqi: number;
  readonly pm25: number;
  readonly pm10: number;
  readonly no2: number;
  readonly o3: number;
}

/** Daily aggregated trend point derived from hourly upstream forecasts. */
export interface DailyTrendPoint {
  readonly dateIso: string;
  readonly avgUsAqi: number;
  readonly maxUsAqi: number;
  readonly minUsAqi: number;
  readonly avgPm25: number;
}

/** Resolved geographic city metadata with rounded coordinates for safe caching. */
export interface CityLocation {
  readonly key: string;
  readonly name: string;
  readonly region: string;
  readonly country: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
}

/** End-to-end air quality snapshot and forecast payload rendered by client views. */
export interface AirQualityReport {
  readonly location: CityLocation;
  readonly updatedAtIso: string;
  readonly source: "open-meteo" | "demo" | "cached";
  readonly current: {
    readonly usAqi: number;
    readonly europeanAqi: number;
    readonly readings: PollutantReadings;
  };
  readonly hourly: readonly HourlyForecastPoint[];
  readonly daily: readonly DailyTrendPoint[];
}

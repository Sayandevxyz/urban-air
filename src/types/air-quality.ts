export type PollutantKey = "pm25" | "pm10" | "no2" | "o3" | "so2" | "co";

export type AqiCategory =
  "good" | "moderate" | "sensitive" | "unhealthy" | "very_unhealthy" | "hazardous";

export type EuropeanAqiBand =
  "good" | "fair" | "moderate" | "poor" | "very_poor" | "extremely_poor";

type SmogSeverity = "none" | "elevated" | "severe_smog" | "smog_emergency";

export interface PollutantReadings {
  readonly pm25: number;
  readonly pm10: number;
  readonly no2: number;
  readonly o3: number;
  readonly so2: number;
  readonly co: number;
}

export interface PollutantAssessment {
  readonly key: PollutantKey;
  readonly valueUgM3: number;
  readonly whoGuidelineUgM3: number;
  readonly whoRatio: number;
  readonly exceedsWho: boolean;
  readonly subIndexUsAqi: number;
  readonly isDominant: boolean;
}

export interface UsAqiClassification {
  readonly category: AqiCategory;
  readonly severityRank: 1 | 2 | 3 | 4 | 5 | 6;
  readonly iconId:
    "leaf" | "sun-cloud" | "shield-alert" | "mask-warning" | "smog-danger" | "biohazard";
  readonly patternId: "solid" | "dots" | "diagonal" | "crosshatch" | "grid" | "dense-bars";
  readonly tokenName: string;
}

export interface SmogAssessment {
  readonly severity: SmogSeverity;
  readonly isWinterSmogAlert: boolean;
  readonly inversionTrapLikely: boolean;
  readonly primaryDrivers: readonly PollutantKey[];
}

export interface HourlyForecastPoint {
  readonly timeIso: string;
  readonly usAqi: number;
  readonly europeanAqi: number;
  readonly pm25: number;
  readonly pm10: number;
  readonly no2: number;
  readonly o3: number;
}

export interface DailyTrendPoint {
  readonly dateIso: string;
  readonly avgUsAqi: number;
  readonly maxUsAqi: number;
  readonly minUsAqi: number;
  readonly avgPm25: number;
}

export interface CityLocation {
  readonly key: string;
  readonly name: string;
  readonly region: string;
  readonly country: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
}

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

import type { AirQualityReport, CityLocation } from "@/domain/types";
import type { Result } from "@/lib/errors";

/**
 * Abstraction over geocoding backends (e.g. Open-Meteo Geocoding, Nominatim, or seeded Demo data).
 */
export interface GeocodingProvider {
  readonly providerName: string;
  searchCities(query: string, signal?: AbortSignal): Promise<Result<readonly CityLocation[]>>;
}

/**
 * Abstraction over air-quality data sources (e.g. Open-Meteo, OpenAQ, WAQI, or Demo data).
 */
export interface AirQualityProvider {
  readonly providerName: string;
  fetchAirQuality(location: CityLocation, signal?: AbortSignal): Promise<Result<AirQualityReport>>;
}

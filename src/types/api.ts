import type { Result } from "@/lib/errors";
import type { AirQualityReport, CityLocation } from "@/types/air-quality";

export type LoadState = "loading" | "ready" | "empty" | "error" | "offline" | "rate_limited";
export type SearchStatus = "idle" | "loading" | "success" | "empty" | "error" | "rate_limited";

export interface GeocodingProvider {
  readonly providerName: string;
  searchCities(query: string, signal?: AbortSignal): Promise<Result<readonly CityLocation[]>>;
}

export interface AirQualityProvider {
  readonly providerName: string;
  fetchAirQuality(location: CityLocation, signal?: AbortSignal): Promise<Result<AirQualityReport>>;
}

export interface FetchGuardOptions {
  readonly method?: "GET" | "POST";
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  readonly signal?: AbortSignal | undefined;
}

export interface CachePolicy {
  readonly ttlMs: number;
  readonly staleTtlMs: number;
}

export interface AssistantResponsePayload {
  readonly reply: string;
  readonly engine: "gemini" | "anthropic" | "fallback";
  readonly refused: boolean;
  readonly dataSource: string;
  readonly updatedAtIso: string;
  readonly disclaimer: string;
}

export interface ChatTurn {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly meta?: string | undefined;
}

export type ApiFetchResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly kind: "aborted" }
  | { readonly ok: false; readonly kind: "rate_limited"; readonly retryAfterSeconds: number }
  | { readonly ok: false; readonly kind: "error"; readonly status: number };

export interface ApiRequestOptions {
  readonly method?: "GET" | "POST";
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly signal?: AbortSignal | undefined;
}

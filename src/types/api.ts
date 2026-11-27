// ============================================================================
// src/types/api.ts
// Defines provider abstractions, cache policies, fetch results, and chat state.
// ============================================================================

import type { Result } from "@/lib/errors";
import type { AirQualityReport, CityLocation } from "@/types/air-quality";

/** Async UI loading lifecycle state surfaced across banners and dashboards. */
export type LoadState = "loading" | "ready" | "empty" | "error" | "offline" | "rate_limited";

/** Autocomplete combobox search request status used by CitySearchBar. */
export type SearchStatus = "idle" | "loading" | "success" | "empty" | "error" | "rate_limited";

/** Pluggable geocoding provider interface decoupling routes from upstream vendors. */
export interface GeocodingProvider {
  readonly providerName: string;
  searchCities(query: string, signal?: AbortSignal): Promise<Result<readonly CityLocation[]>>;
}

/** Pluggable air-quality telemetry provider interface enabling vendor substitution. */
export interface AirQualityProvider {
  readonly providerName: string;
  fetchAirQuality(location: CityLocation, signal?: AbortSignal): Promise<Result<AirQualityReport>>;
}

/** Configuration passed to the SSRF-guarded server fetch wrapper. */
export interface FetchGuardOptions {
  readonly method?: "GET" | "POST";
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  readonly signal?: AbortSignal | undefined;
}

/** Fresh and stale-while-revalidate time-to-live bounds for in-memory caching. */
export interface CachePolicy {
  readonly ttlMs: number;
  readonly staleTtlMs: number;
}

/** Sanitized JSON response envelope returned by POST /api/chat. */
export interface AssistantResponsePayload {
  readonly reply: string;
  readonly engine: "gemini" | "anthropic" | "fallback";
  readonly refused: boolean;
  readonly dataSource: string;
  readonly updatedAtIso: string;
  readonly disclaimer: string;
}

/** Single conversation turn held in client chat history state. */
export interface ChatTurn {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly meta?: string | undefined;
}

/** Discriminated client fetch outcome separating aborts, 429 cooldowns, and errors. */
export type ApiFetchResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly kind: "aborted" }
  | { readonly ok: false; readonly kind: "rate_limited"; readonly retryAfterSeconds: number }
  | { readonly ok: false; readonly kind: "error"; readonly status: number };

/** Normalized HTTP request options accepted by the client fetch wrapper. */
export interface ApiRequestOptions {
  readonly method?: "GET" | "POST";
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly signal?: AbortSignal | undefined;
}
